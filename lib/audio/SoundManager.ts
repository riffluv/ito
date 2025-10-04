/* eslint-disable @typescript-eslint/no-misused-promises */
import { logDebug } from "@/lib/utils/log";
import { AUDIO_EXTENSIONS, SFX_BASE_PATH, SOUND_INDEX } from "./registry";
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

type PendingLoad = Promise<{ buffer: AudioBuffer; url: string } | null>;

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

const ensureLeadingSlash = (path: string) =>
  path.startsWith("/") ? path : `/${path}`;

const buildCandidateUrls = (src: string) => {
  const base = src.startsWith("/")
    ? src
    : `${SFX_BASE_PATH.replace(/\/$/, "")}/${src.replace(/^\//, "")}`;
  if (/\.[a-zA-Z0-9]+$/.test(base)) {
    return [ensureLeadingSlash(base)];
  }
  return AUDIO_EXTENSIONS.map((extension) =>
    ensureLeadingSlash(`${base}.${extension}`)
  );
};

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

  constructor() {
    if (!isBrowser()) return;
    this.settings = this.restoreSettings();
    document.addEventListener("visibilitychange", this.handleVisibilityChange, {
      passive: true,
    });
    this.attachUnlockHandlers();
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

  async play(soundId: SoundId, overrides?: PlaybackOverrides): Promise<void> {
    if (!isBrowser()) return;
    if (this.settings.muted || this.settings.masterVolume <= 0) return;

    const definition = SOUND_INDEX[soundId];
    if (!definition) return;

    const context = this.ensureContext();
    if (!context || !this.masterGain) return;

    await this.resumeContext();

    const variant = pickVariant(definition.variants);
    const asset = await this.loadVariant(definition, variant);
    if (!asset) return;

    const { buffer, url } = asset;

    if (definition.stopPrevious) {
      this.stopHandles.get(soundId)?.();
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

    const context = new Ctor();
    this.context = context as AudioContext;

    const master = context.createGain();
    this.masterGain = master;
    master.gain.value = this.settings.muted ? 0 : this.settings.masterVolume;
    master.connect(context.destination);

    SOUND_CATEGORIES.forEach((category) => {
      const gain = context.createGain();
      gain.gain.value = this.settings.categoryVolume[category];
      gain.connect(master);
      this.categoryGains.set(category, gain);
    });

    return this.context;
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

  private async loadVariant(
    definition: SoundDefinition,
    variant: SoundVariant
  ): Promise<{ buffer: AudioBuffer; url: string } | null> {
    const candidates = buildCandidateUrls(variant.src);
    for (const url of candidates) {
      if (this.missingAssets.has(url)) continue;
      const asset = await this.fetchBuffer(url);
      if (asset) {
        return asset;
      }
      this.missingAssets.add(url);
      this.emit({ type: "missing", soundId: definition.id, attemptedUrl: url });
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
      if (!context) return null;
      try {
        const response = await fetch(url, { cache: "force-cache" });
        if (!response.ok) {
          return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
        this.buffers.set(url, decoded);
        return { buffer: decoded, url };
      } catch (error) {
        console.warn(
          `[_SoundManager] Failed to load sound asset at ${url}`,
          error
        );
        return null;
      } finally {
        this.pendingLoads.delete(url);
      }
    })();

    this.pendingLoads.set(url, loader);
    return loader;
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

  private applyGainTargets() {
    if (!this.context || !this.masterGain) return;
    const now = this.context.currentTime;
    const masterTarget = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(masterTarget, now + 0.05);
    this.categoryGains.forEach((gain, category) => {
      const target = this.settings.categoryVolume[category] ?? 1;
      gain.gain.cancelScheduledValues(now);
      gain.gain.linearRampToValueAtTime(target, now + 0.05);
    });
  }

  private handleVisibilityChange = () => {
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
      this.context.resume().catch(() => undefined);
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
