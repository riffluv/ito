/* eslint-disable @typescript-eslint/no-misused-promises */
import { logDebug } from "@/lib/utils/log";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { recordMetricDistribution } from "@/lib/perf/metricsClient";
import { SOUND_INDEX } from "./registry";
import { buildCandidateUrls } from "./paths";
import {
  DEFAULT_SOUND_SETTINGS,
  PlaybackOverrides,
  Range,
  SOUND_CATEGORIES,
  SoundCategory,
  SoundDefinition,
  SoundEvent,
  SoundId,
  SoundSettings,
  SoundSuccessMode,
  SoundVariant,
} from "./types";

const SETTINGS_STORAGE_KEY = "ito:sound:settings:v1";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type Subscriber = (event: SoundEvent) => void;

type PendingLoad = Promise<{ buffer: AudioBuffer; url: string }>;

class SoundAssetError extends Error {
  constructor(
    public url: string,
    public permanent: boolean,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = "SoundAssetError";
  }
}

const isBrowser = () => typeof window !== "undefined";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const pickInRange = (range: Range | undefined, fallback: number) => {
  if (!range) return fallback;
  const min = Math.min(range.min, range.max);
  const max = Math.max(range.min, range.max);
  if (min === max) return min;
  return min + Math.random() * (max - min);
};

const pickVariant = (variants: SoundVariant[]) => {
  if (variants.length === 0) {
    throw new Error("Sound definition must include at least one variant");
  }
  const weights = variants.map((variant) => variant.weight ?? 1);
  const total = weights.reduce((acc, weight) => acc + weight, 0);
  let cursor = Math.random() * total;
  for (let index = 0; index < variants.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) {
      return variants[index];
    }
  }
  return variants[variants.length - 1];
};

const dbToLinear = (db: number) => 10 ** (db / 20);

const cloneSettings = (settings: SoundSettings): SoundSettings => ({
  masterVolume: settings.masterVolume,
  muted: settings.muted,
  categoryVolume: { ...settings.categoryVolume },
  successMode: settings.successMode,
});

export class SoundManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private categoryGains = new Map<SoundCategory, GainNode>();
  private buffers = new Map<string, AudioBuffer>();
  private pendingLoads = new Map<string, PendingLoad>();
  private missingAssets = new Set<string>();
  private stopHandles = new Map<SoundId, () => void>();
  private listeners = new Set<Subscriber>();
  private settings: SoundSettings = cloneSettings(DEFAULT_SOUND_SETTINGS);
  private unlockAttached = false;
  private readonly unlockHandler = () => void this.tryUnlockContext();
  private ambientDuckAmount = 1;
  private ambientDuckTimeout: number | null = null;
  private pendingPlays: { soundId: SoundId; overrides?: PlaybackOverrides }[] = [];
  private bootstrapTimestamp =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  private firstUnlockRecorded = false;
  private firstPlayRecorded = false;
  private lastVisibilityResumeAt: number | null = null;
  private firstSoundAfterVisibilityRecorded = false;
  private pendingInputMetric: { timestamp: number; recorded: boolean } | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private workletSetupPromise: Promise<void> | null = null;

  constructor() {
    if (!isBrowser()) return;
    this.settings = this.restoreSettings();
    document.addEventListener("visibilitychange", this.handleVisibilityChange, {
      passive: true,
    });
    this.attachUnlockHandlers();
  }

  async warmup(): Promise<void> {
    if (!isBrowser()) return;
    const context = this.ensureContext();
    if (context) {
      await this.resumeContext();
    }
    await this.flushPendingPlays();
  }

  getSettings(): SoundSettings {
    return cloneSettings(this.settings);
  }

  subscribe(listener: Subscriber) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Pre-decode targeted sound assets to avoid first-play latency. */
  async prewarm(soundIds: SoundId[] = []): Promise<void> {
    if (!isBrowser()) return;
    if (soundIds.length === 0) return;

    const context = this.ensureContext();
    if (!context) return;

    const uniqueIds = Array.from(new Set(soundIds));
    const tasks = uniqueIds.map((id) => this.warmupDefinition(SOUND_INDEX[id]));
    if (tasks.length === 0) return;

    await Promise.allSettled(tasks);
  }

  markUserInteraction(): void {
    if (!isBrowser()) return;
    const timestamp =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    this.pendingInputMetric = { timestamp, recorded: false };
  }

  async prepareForInteraction(): Promise<void> {
    if (!isBrowser()) return;
    const context = this.ensureContext();
    if (!context) return;
    await this.resumeContext();
  }

  async play(
    soundId: SoundId,
    overrides?: PlaybackOverrides,
    internal = false
  ): Promise<void> {
    if (!isBrowser()) return;
    if (this.settings.muted || this.settings.masterVolume <= 0) return;

    const definition = SOUND_INDEX[soundId];
    if (!definition) return;

    const context = this.ensureContext();
    if (!context || !this.masterGain) return;

    const nowTimestamp =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    if (!internal) {
      if (!this.firstPlayRecorded) {
        setMetric(
          "audio",
          "firstSoundSinceBootMs",
          Math.round(nowTimestamp - this.bootstrapTimestamp)
        );
        this.firstPlayRecorded = true;
      }
      if (
        this.lastVisibilityResumeAt != null &&
        !this.firstSoundAfterVisibilityRecorded
      ) {
        const delta = nowTimestamp - this.lastVisibilityResumeAt;
        setMetric("audio", "lastVisibilityToSoundMs", Math.round(delta));
        bumpMetric("audio", "visibilityToSoundSamples", 1);
        this.firstSoundAfterVisibilityRecorded = true;
      }
    }

    if (this.pendingInputMetric && !this.pendingInputMetric.recorded) {
      const delta = nowTimestamp - this.pendingInputMetric.timestamp;
      if (delta >= 0 && Number.isFinite(delta)) {
        const rounded = Math.round(delta);
        setMetric("audio", "pointerToSoundMs", rounded);
        recordMetricDistribution("client.audio.pointerToSound", rounded, {
          sound: soundId,
          mode: internal ? "internal" : "user",
        });
      }
      this.pendingInputMetric.recorded = true;
      this.pendingInputMetric = null;
    }

    await this.resumeContext();

    if (!internal && this.context?.state === "suspended") {
      this.enqueuePendingPlay(soundId, overrides);
      return;
    }

    const variant = pickVariant(definition.variants);
    const asset = await this.loadVariant(definition, variant);
    if (!asset) return;

    const { buffer, url } = asset;

    if (definition.stopPrevious) {
      this.stopHandles.get(soundId)?.();
    }

    if (definition.category !== "ambient") {
      this.triggerAmbientDuck(definition.duck);
    }

    const playbackRate = clamp(
      overrides?.playbackRate ?? pickInRange(definition.playbackRateRange, 1),
      0.5,
      2.5
    );

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    source.loop = definition.loop ?? false;

    const { gainNode, disconnect } = this.createOutputChain(
      definition,
      variant,
      overrides
    );
    source.connect(gainNode);

    const delayRange: Range | undefined =
      definition.maxDelaySeconds !== undefined
        ? {
            min: definition.minDelaySeconds ?? 0,
            max: definition.maxDelaySeconds,
          }
        : definition.minDelaySeconds !== undefined
          ? { min: definition.minDelaySeconds, max: definition.minDelaySeconds }
          : undefined;

    const delaySeconds = pickInRange(delayRange, 0);
    const offsetSeconds = clamp(
      pickInRange(definition.startOffsetMsRange, 0) / 1000,
      0,
      Math.max(0, buffer.duration - 0.01)
    );

    const startTime = context.currentTime + delaySeconds;
    source.start(startTime, offsetSeconds);

    const cleanup = () => {
      try {
        source.removeEventListener("ended", onEnded);
        source.disconnect();
      } catch (error) {
        logDebug("sound", "source cleanup failed", error);
      }
      disconnect();
    };

    const stopNow = () => {
      cleanup();
      try {
        source.stop();
      } catch (error) {
        // ignore already stopped
      }
    };

    const onEnded = () => {
      cleanup();
      if (this.stopHandles.get(soundId) === stopNow) {
        this.stopHandles.delete(soundId);
      }
    };

    source.addEventListener("ended", onEnded, { once: true });

    if (definition.stopPrevious) {
      this.stopHandles.set(soundId, stopNow);
    }

    if (!buffer.duration) {
      console.warn(
        `[SoundManager] ${soundId} loaded from ${url} has zero duration.`
      );
    }

    bumpMetric("audio", "playCount", 1);
    setMetric("audio", "lastSoundId", soundId);
  }

  setMuted(muted: boolean) {
    if (this.settings.muted === muted) return;
    this.settings = { ...this.settings, muted };
    this.persistAndNotify();
    this.applyGainTargets();
  }

  setMasterVolume(volume: number) {
    const normalized = clamp(volume, 0, 1);
    if (this.settings.masterVolume === normalized) return;
    this.settings = { ...this.settings, masterVolume: normalized };
    this.persistAndNotify();
    this.applyGainTargets();
  }

  setSuccessMode(mode: SoundSuccessMode) {
    if (this.settings.successMode === mode) return;
    this.settings = { ...this.settings, successMode: mode };
    this.persistAndNotify();
  }

  setCategoryVolume(category: SoundCategory, volume: number) {
    const normalized = clamp(volume, 0, 1);
    if (this.settings.categoryVolume[category] === normalized) return;
    this.settings = {
      ...this.settings,
      categoryVolume: {
        ...this.settings.categoryVolume,
        [category]: normalized,
      },
    };
    this.persistAndNotify();
    this.applyGainTargets();
  }

  stop(soundId: SoundId) {
    const stopHandle = this.stopHandles.get(soundId);
    if (!stopHandle) return;
    stopHandle();
    this.stopHandles.delete(soundId);
  }

  destroy() {
    if (!isBrowser()) return;
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );
    this.detachUnlockHandlers();
    this.stopHandles.forEach((stop) => stop());
    this.stopHandles.clear();
    this.listeners.clear();
    this.pendingLoads.clear();
    this.missingAssets.clear();
    if (this.ambientDuckTimeout !== null) {
      window.clearTimeout(this.ambientDuckTimeout);
      this.ambientDuckTimeout = null;
    }
    this.ambientDuckAmount = 1;
    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch {
        // ignore
      }
      this.workletNode = null;
    }
    this.workletSetupPromise = null;
    if (this.context) {
      try {
        this.context.close();
      } catch (error) {
        console.warn("[SoundManager] Failed to close audio context", error);
      }
      this.context = null;
      this.masterGain = null;
      this.categoryGains.clear();
    }
  }

  private ensureContext(): AudioContext | null {
    if (!isBrowser()) return null;
    if (this.context) return this.context;

    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) {
      console.warn("[SoundManager] Web Audio API is not available.");
      return null;
    }

    let context: AudioContext;
    try {
      // 低遅延ヒント（未対応環境では無視/失敗時にフォールバック）
      // @ts-ignore legacy webkit constructor may not accept options
      context = new Ctor({ latencyHint: "interactive" } as any) as AudioContext;
    } catch {
      // @ts-ignore legacy webkit fallback
      context = new (Ctor as any)() as AudioContext;
    }
    this.context = context as AudioContext;

    const master = context.createGain();
    this.masterGain = master;
    master.gain.value = this.settings.muted ? 0 : this.settings.masterVolume;
    this.connectMasterGain();

    SOUND_CATEGORIES.forEach((category) => {
      const gain = context.createGain();
      gain.gain.value = this.settings.categoryVolume[category];
      gain.connect(master);
      this.categoryGains.set(category, gain);
    });

    this.setupAudioWorklet(context);

    return this.context;
  }

  private connectMasterGain() {
    if (!this.context || !this.masterGain) return;
    try {
      this.masterGain.disconnect();
    } catch {
      // ignore disconnect errors
    }
    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch {
        // ignore
      }
      try {
        this.masterGain.connect(this.workletNode);
        this.workletNode.connect(this.context.destination);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        traceError("audio.worklet.connectFailed", err);
        try {
          this.masterGain.connect(this.context.destination);
        } catch {}
      }
    } else {
      try {
        this.masterGain.connect(this.context.destination);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        traceError("audio.master.connectFailed", err);
      }
    }
  }

  private setupAudioWorklet(context: AudioContext) {
    if (!isBrowser()) return;
    if (!context.audioWorklet) return;
    if (this.workletNode || this.workletSetupPromise) return;

    const moduleUrl = new URL("/audio-worklets/ito-mixer.js", window.location.origin).toString();

    this.workletSetupPromise = (async () => {
      try {
        await context.audioWorklet.addModule(moduleUrl);
        if (!this.context || this.context !== context) {
          return;
        }
        const node = new AudioWorkletNode(context, "ito-mixer", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [Math.max(1, context.destination.channelCount ?? 2)],
        });
        if (typeof node.port?.start === "function") {
          try {
            node.port.start();
          } catch {
            // ignore
          }
        }
        node.onprocessorerror = (event: unknown) => {
          const raw =
            event instanceof ErrorEvent ? event.error : event instanceof Error ? event : null;
          if (raw) {
            const err = raw instanceof Error ? raw : new Error(String(raw));
            traceError("audio.worklet.processorError", err);
          }
        };
        this.workletNode = node;
        if (typeof context.baseLatency === "number") {
          setMetric("audio", "worklet.baseLatencyMs", Math.round(context.baseLatency * 1000));
        }
        const outputLatency = (context as any)?.outputLatency;
        if (typeof outputLatency === "number") {
          setMetric("audio", "worklet.outputLatencyMs", Math.round(outputLatency * 1000));
        }
        this.connectMasterGain();
        traceAction("audio.worklet.ready", {
          baseLatency: context.baseLatency ?? null,
          outputLatency: outputLatency ?? null,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        traceError("audio.worklet.initFailed", err);
        this.workletNode = null;
      } finally {
        this.workletSetupPromise = null;
      }
    })();
  }

  private getCategoryGain(category: SoundCategory): GainNode {
    if (!this.context || !this.masterGain) {
      throw new Error("Audio context is not initialised");
    }
    const existing = this.categoryGains.get(category);
    if (existing) return existing;
    const gain = this.context.createGain();
    gain.gain.value = this.settings.categoryVolume[category] ?? 1;
    gain.connect(this.masterGain);
    this.categoryGains.set(category, gain);
    return gain;
  }

  private async resumeContext() {
    if (!this.context) return;
    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch (error) {
        console.warn("[SoundManager] Failed to resume audio context", error);
      }
    }
  }

  private createOutputChain(
    definition: SoundDefinition,
    variant: SoundVariant,
    overrides?: PlaybackOverrides
  ) {
    if (!this.context) throw new Error("Audio context missing");
    const categoryGain = this.getCategoryGain(definition.category);
    const gainNode = this.context.createGain();
    const randomDb = pickInRange(definition.gainDbRange, 0);
    const baseGain = dbToLinear(randomDb);
    const variantGain = variant.gainMultiplier ?? 1;
    const overrideGain = overrides?.volumeMultiplier ?? 1;
    gainNode.gain.value = clamp(baseGain * variantGain * overrideGain, 0, 4);
    gainNode.connect(categoryGain);

    const disconnect = () => {
      try {
        gainNode.disconnect();
      } catch (error) {
        logDebug("sound", "gain disconnect failed", error);
      }
    };

    return { gainNode, disconnect };
  }


  private async warmupDefinition(definition: SoundDefinition): Promise<void> {
    if (definition.variants.length === 0) {
      return;
    }
    await Promise.allSettled(
      definition.variants.map((variant) =>
        this.loadVariant(definition, variant)
      )
    );
  }

  private async loadVariant(
    definition: SoundDefinition,
    variant: SoundVariant
  ): Promise<{ buffer: AudioBuffer; url: string } | null> {
    const candidates = buildCandidateUrls(variant.src);
    for (const url of candidates) {
      if (this.missingAssets.has(url)) continue;
      try {
        const asset = await this.fetchBuffer(url);
        return asset;
      } catch (error) {
        if (error instanceof SoundAssetError) {
          if (error.permanent) {
            this.missingAssets.add(url);
            this.emit({ type: "missing", soundId: definition.id, attemptedUrl: url });
          } else {
            console.warn(
              `[SoundManager] Transient audio load failure for ${definition.id} (${url})`,
              error.cause ?? error
            );
          }
        } else {
          console.warn(
            `[SoundManager] Unexpected audio load error for ${definition.id} (${url})`,
            error
          );
        }
      }
    }
    console.warn(
      `[SoundManager] No audio file resolved for ${definition.id}. Tried: ${candidates.join(", ")}`
    );
    return null;
  }

  private fetchBuffer(url: string): PendingLoad {
    const cached = this.buffers.get(url);
    if (cached) {
      return Promise.resolve({ buffer: cached, url });
    }

    const pending = this.pendingLoads.get(url);
    if (pending) {
      return pending;
    }

    const loader: PendingLoad = (async () => {
      const context = this.ensureContext();
      if (!context) {
        throw new SoundAssetError(url, false, "Audio context is not available");
      }
      try {
        const response = await fetch(url, { cache: "force-cache" });
        if (!response.ok) {
          const permanent = response.status === 404 || response.status === 410;
          throw new SoundAssetError(
            url,
            permanent,
            `Failed to fetch audio asset (status: ${response.status})`
          );
        }
        const arrayBuffer = await response.arrayBuffer();
        try {
          const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
          this.buffers.set(url, decoded);
          return { buffer: decoded, url };
        } catch (decodeError) {
          const permanent = this.isDecodePermanent(decodeError);
          throw new SoundAssetError(
            url,
            permanent,
            "Failed to decode audio data",
            decodeError
          );
        }
      } catch (error) {
        if (error instanceof SoundAssetError) {
          throw error;
        }
        throw new SoundAssetError(url, false, "Unexpected audio load error", error);
      } finally {
        this.pendingLoads.delete(url);
      }
    })();

    this.pendingLoads.set(url, loader);
    return loader;
  }

  private isDecodePermanent(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const name = (error as any).name;
    if (name === "NotSupportedError" || name === "EncodingError") {
      return true;
    }
    const message = typeof (error as any).message === "string" ? (error as any).message.toLowerCase() : "";
    if (!message) return false;
    return (
      message.includes("unsupported") ||
      message.includes("unknown content type") ||
      message.includes("invalid audio data")
    );
  }

  private restoreSettings(): SoundSettings {
    if (!isBrowser()) return cloneSettings(DEFAULT_SOUND_SETTINGS);
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return cloneSettings(DEFAULT_SOUND_SETTINGS);
      const parsed = JSON.parse(raw) as Partial<SoundSettings>;
      const merged: SoundSettings = cloneSettings(DEFAULT_SOUND_SETTINGS);
      if (typeof parsed.masterVolume === "number") {
        merged.masterVolume = clamp(parsed.masterVolume, 0, 1);
      }
      if (typeof parsed.muted === "boolean") {
        merged.muted = parsed.muted;
      }
      SOUND_CATEGORIES.forEach((category) => {
        const value = parsed.categoryVolume?.[category];
        if (typeof value === "number") {
          merged.categoryVolume[category] = clamp(value, 0, 1);
        }
      });
      const legacyResult = (parsed as any)?.categoryVolume?.result;
      if (typeof legacyResult === "number") {
        merged.categoryVolume.fanfare = clamp(legacyResult, 0, 1);
      }
      if ((merged.categoryVolume as any)?.result !== undefined) {
        delete (merged.categoryVolume as any).result;
      }
      if (parsed.successMode === "epic" || parsed.successMode === "normal") {
        merged.successMode = parsed.successMode;
      }
      return merged;
    } catch (error) {
      console.warn(
        "[SoundManager] Failed to parse stored sound settings",
        error
      );
      return cloneSettings(DEFAULT_SOUND_SETTINGS);
    }
  }

  private persistAndNotify() {
    if (isBrowser()) {
      try {
        window.localStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify(this.settings)
        );
      } catch (error) {
        console.warn("[SoundManager] Failed to persist sound settings", error);
      }
    }
    this.emit({ type: "settings", settings: this.getSettings() });
  }

  private applyGainTargets(rampSeconds = 0.05) {
    if (!this.context || !this.masterGain) return;
    const now = this.context.currentTime;
    const masterTarget = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(masterTarget, now + rampSeconds);
    this.categoryGains.forEach((gain, category) => {
      const target = this.getCategoryTarget(category);
      gain.gain.cancelScheduledValues(now);
      gain.gain.linearRampToValueAtTime(target, now + rampSeconds);
    });
  }

  private getCategoryTarget(category: SoundCategory) {
    const base = this.settings.categoryVolume[category] ?? 1;
    if (category === "ambient") {
      return base * this.ambientDuckAmount;
    }
    return base;
  }

  private triggerAmbientDuck(options?: { amount?: number; releaseMs?: number }) {
    if (!isBrowser()) return;
    if (this.settings.categoryVolume.ambient <= 0) return;
    const amount = clamp(options?.amount ?? 0.5, 0, 1);
    const releaseMs = Math.max(0, options?.releaseMs ?? 240);
    this.ambientDuckAmount = amount;
    this.applyGainTargets(0.12);
    if (this.ambientDuckTimeout !== null) {
      window.clearTimeout(this.ambientDuckTimeout);
    }
    this.ambientDuckTimeout = window.setTimeout(() => {
      this.ambientDuckAmount = 1;
      this.applyGainTargets(0.12);
      this.ambientDuckTimeout = null;
    }, releaseMs);
  }

  private enqueuePendingPlay(soundId: SoundId, overrides?: PlaybackOverrides) {
    if (this.pendingPlays.length > 8) {
      this.pendingPlays.shift();
    }
    this.pendingPlays.push({ soundId, overrides });
    this.attachUnlockHandlers();
  }

  private async flushPendingPlays() {
    if (!this.pendingPlays.length) return;
    const queue = [...this.pendingPlays];
    this.pendingPlays.length = 0;
    for (const item of queue) {
      await this.play(item.soundId, item.overrides, true);
    }
  }

  private handleVisibilityChange = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "hidden") {
      this.lastVisibilityResumeAt = null;
      this.firstSoundAfterVisibilityRecorded = false;
      bumpMetric("audio", "visibilityHidden", 1);
    } else if (document.visibilityState === "visible") {
      this.lastVisibilityResumeAt =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      this.firstSoundAfterVisibilityRecorded = false;
      bumpMetric("audio", "visibilityVisible", 1);
    }

    if (!this.context) return;
    if (
      document.visibilityState === "hidden" &&
      this.context.state === "running"
    ) {
      this.context.suspend().catch(() => undefined);
    } else if (
      document.visibilityState === "visible" &&
      this.context.state === "suspended"
    ) {
      this.context
        .resume()
        .then(() => this.flushPendingPlays())
        .catch(() => undefined);
    }
  };

  private attachUnlockHandlers() {
    if (this.unlockAttached || !isBrowser()) return;
    window.addEventListener("pointerdown", this.unlockHandler, {
      passive: true,
    });
    window.addEventListener("keydown", this.unlockHandler, { passive: true });
    window.addEventListener("touchstart", this.unlockHandler, {
      passive: true,
    });
    this.unlockAttached = true;
  }

  private detachUnlockHandlers() {
    if (!this.unlockAttached || !isBrowser()) return;
    window.removeEventListener("pointerdown", this.unlockHandler);
    window.removeEventListener("keydown", this.unlockHandler);
    window.removeEventListener("touchstart", this.unlockHandler);
    this.unlockAttached = false;
  }

  private async tryUnlockContext() {
    if (!this.context) {
      this.ensureContext();
    }
    await this.resumeContext();
    if (this.context && this.context.state === "running") {
      if (!this.firstUnlockRecorded) {
        const now =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        setMetric(
          "audio",
          "firstUnlockMs",
          Math.round(now - this.bootstrapTimestamp)
        );
        this.firstUnlockRecorded = true;
      }
      bumpMetric("audio", "unlocks", 1);
      await this.flushPendingPlays();
      this.detachUnlockHandlers();
    }
  }

  private emit(event: SoundEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("[SoundManager] subscriber error", error);
      }
    });
  }
}


