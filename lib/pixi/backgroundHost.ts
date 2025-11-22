import { Application, Container } from "@/lib/pixi/instance";
import {
  DEFAULT_BACKGROUND_PROFILE,
  type PixiBackgroundProfile,
} from "@/lib/pixi/backgroundTypes";
import {
  createSimpleBackground,
  type BackgroundQuality,
  type SimpleBackgroundController,
  type SimpleBackgroundMetrics,
} from "@/lib/pixi/simpleBackground";
import {
  createDragonQuestBackground,
  type DragonQuestBackgroundController,
} from "@/lib/pixi/dragonQuestBackground";
import {
  createInfernoBackground,
  type InfernoBackgroundController,
} from "@/lib/pixi/infernoBackground";
import { logInfo, logError } from "@/lib/utils/log";

type PixiSceneKey = "pixi-simple" | "pixi-dq" | "pixi-inferno";

type SceneEffects = {
  lightSweep?: () => void;
  launchFireworks?: () => void;
  launchMeteors?: () => void;
  launchVolcanoEruption?: () => void;
  flashRed?: (count?: number, duration?: number) => void;
  updatePointerGlow?: (active: boolean) => void;
  setQuality?: (quality: BackgroundQuality) => void;
};

type SceneInstance = {
  key: PixiSceneKey;
  container: Container;
  resize: (width: number, height: number) => void;
  destroy: () => void;
  effects: SceneEffects;
};

export type SetSceneResult = {
  renderer: "pixi" | "dom";
  quality: BackgroundQuality;
  effects?: SceneEffects;
};

type NextDataWithAssetPrefix = {
  assetPrefix?: string;
};

const PIXI_WORKER_PUBLIC_PATH = "/workers/pixi-background-worker.js";
const PIXI_WORKER_CACHE_BUST = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

const resolveWorkerAssetPrefix = () => {
  if (typeof window === "undefined") return "";
  const nextData = (globalThis as typeof globalThis & {
    __NEXT_DATA__?: NextDataWithAssetPrefix;
  }).__NEXT_DATA__;
  const fromNext = nextData?.assetPrefix ?? "";
  const fallback = process.env.NEXT_PUBLIC_ASSET_PREFIX ?? "";
  return (fromNext || fallback || "").replace(/\/$/, "");
};

const buildWorkerAssetUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  const prefix = resolveWorkerAssetPrefix();
  const isAbsolute = /^https?:\/\//i.test(prefix);
  const base = isAbsolute ? prefix : `${window.location.origin}${prefix}`;
  const cacheBust = PIXI_WORKER_CACHE_BUST ? `?v=${PIXI_WORKER_CACHE_BUST}` : "";
  return `${base}${PIXI_WORKER_PUBLIC_PATH}${cacheBust}`;
};

type SceneOptions = {
  key: PixiSceneKey;
  quality: BackgroundQuality;
  onMetrics?: (metrics: SimpleBackgroundMetrics) => void;
  profile?: PixiBackgroundProfile;
};

class WorkerBackgroundHost implements BackgroundHostLike {
  private worker: Worker | null = null;
  private canvasHolder: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private currentScene: PixiSceneKey | null = null;
  private currentQuality: BackgroundQuality = "low";
  private requestedProfile: PixiBackgroundProfile = DEFAULT_BACKGROUND_PROFILE;
  private initRequestId = 0;
  private sceneRequestId = 0;
  private pending = new Map<number, (result: SetSceneResult) => void>();
  private fatal = false;
  private canvasVisible = true;
  private resizeListener: (() => void) | null = null;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((reason?: unknown) => void) | null = null;
  private workerUrlCache: string | null = null;

  constructor(private onFatal?: (reason: string) => void) {}

  isSupported(): boolean {
    return shouldPreferWorkerBackground();
  }

  private createCanvasIfNeeded() {
    if (this.canvas) return;
    if (typeof document === "undefined") return;
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.inset = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.opacity = this.canvasVisible ? "1" : "0";
  }

  private getWorkerUrl(): string {
    if (!this.workerUrlCache) {
      const resolved = buildWorkerAssetUrl();
      if (!resolved) {
        throw new Error("Pixi background worker asset is unavailable");
      }
      this.workerUrlCache = resolved;
    }
    return this.workerUrlCache;
  }

  private startWorker(width: number, height: number) {
    if (!this.canvas) throw new Error("Canvas is not attached");
    const workerUrl = this.getWorkerUrl();
    this.worker = new Worker(workerUrl, { type: "module" });
    this.worker.onmessage = this.handleWorkerMessage;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });

    let offscreen: OffscreenCanvas | null = null;
    try {
      offscreen = this.canvas.transferControlToOffscreen();
    } catch (error) {
      this.worker.terminate();
      this.worker = null;
      throw error;
    }
    this.initRequestId += 1;
    this.worker.postMessage(
      {
        type: "init",
        width,
        height,
        canvas: offscreen,
        profile: this.requestedProfile,
        requestId: this.initRequestId,
      },
      [offscreen]
    );
  }

  private handleWorkerMessage = (event: MessageEvent) => {
    const data = event.data ?? {};
    if (data.type === "debug") {
      logInfo("pixi-background-host", `worker:${data.message}`, data.detail);
      return;
    }
    if (data.type === "ready") {
      this.resolveReady?.();
      this.resolveReady = null;
      this.rejectReady = null;
      return;
    }
    if (data.type === "scene-ready") {
      const resolver = this.pending.get(data.requestId);
      if (resolver) {
        this.pending.delete(data.requestId);
        resolver({
          renderer: "pixi",
          quality: data.quality as BackgroundQuality,
          effects: this.createEffectProxy(),
        });
      }
      return;
    }
    if (data.type === "error") {
      logError("pixi-background-host", "worker-error", data.message ?? data);
      const resolver = this.pending.get(data.requestId);
      this.pending.delete(data.requestId);
      if (resolver) {
        resolver({ renderer: "dom", quality: this.currentQuality });
      }
      return;
    }
    if (data.type === "fallback") {
      this.triggerFatal(data.reason ?? "worker-fallback");
      return;
    }
    if (data.type === "context-lost") {
      if (data.count >= 3) {
        this.triggerFatal("context-lost-loop");
      }
      return;
    }
  };

  private createEffectProxy(): SceneEffects {
    return {
      lightSweep: () => this.worker?.postMessage({ type: "effect", effect: "lightSweep" }),
      launchFireworks: () =>
        this.worker?.postMessage({ type: "effect", effect: "fireworks" }),
      launchMeteors: () => this.worker?.postMessage({ type: "effect", effect: "meteors" }),
      launchVolcanoEruption: () =>
        this.worker?.postMessage({ type: "effect", effect: "infernoVolcano" }),
      flashRed: () => this.worker?.postMessage({ type: "effect", effect: "flashRed" }),
    };
  }

  private triggerFatal(reason: string) {
    this.fatal = true;
    this.pending.forEach((resolve) =>
      resolve({ renderer: "dom", quality: this.currentQuality })
    );
    this.pending.clear();
    this.rejectReady?.(reason);
    this.readyPromise = null;
    this.resolveReady = null;
    this.rejectReady = null;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pixiBackgroundContextLost", { detail: { reason } })
      );
    }
    this.dispose();
    this.onFatal?.(reason);
  }

  private ensureWorker() {
    if (this.fatal) {
      throw new Error("Worker background disabled due to previous failure");
    }
    if (this.worker) return;
    const width = window.innerWidth || 1920;
    const height = window.innerHeight || 1080;
    this.startWorker(width, height);
  }

  setCanvasVisible(visible: boolean) {
    this.canvasVisible = visible;
    if (this.canvas) {
      this.canvas.style.opacity = visible ? "1" : "0";
    }
  }

  async attachCanvas(host: HTMLElement | null) {
    if (!host) return;
    this.canvasHolder = host;
    this.createCanvasIfNeeded();
    if (!this.canvas) return;
    if (this.canvas.parentElement !== host) {
      host.appendChild(this.canvas);
    }
    this.ensureWorker();
    const width = window.innerWidth || 1920;
    const height = window.innerHeight || 1080;
    this.worker?.postMessage({ type: "resize", width, height });
    if (typeof window !== "undefined" && !this.resizeListener) {
      this.resizeListener = () => {
        const w = window.innerWidth || 1920;
        const h = window.innerHeight || 1080;
        this.worker?.postMessage({ type: "resize", width: w, height: h });
      };
      window.addEventListener("resize", this.resizeListener, { passive: true });
    }
  }

  detachCanvas(host: HTMLElement | null) {
    if (!host || !this.canvas) return;
    if (this.canvas.parentElement === host) {
      host.removeChild(this.canvas);
    }
    this.canvasHolder = null;
  }

  dispose() {
    this.pending.clear();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.currentScene = null;
    this.readyPromise = null;
    this.resolveReady = null;
    this.rejectReady = null;
    if (typeof window !== "undefined" && this.resizeListener) {
      window.removeEventListener("resize", this.resizeListener);
    }
    this.resizeListener = null;
  }

  setPerformanceProfile(profile: PixiBackgroundProfile) {
    this.requestedProfile = profile;
    if (this.worker) {
      this.worker.postMessage({ type: "setProfile", profile });
    }
  }

  async setScene(options: SceneOptions): Promise<SetSceneResult> {
    if (!this.isSupported()) {
      return { renderer: "dom", quality: options.quality };
    }
    this.currentScene = options.key;
    this.currentQuality = options.quality;
    this.ensureWorker();
    if (!this.worker) {
      return { renderer: "dom", quality: options.quality };
    }
    if (this.readyPromise) {
      await this.readyPromise;
    }
    this.sceneRequestId += 1;
    const requestId = this.sceneRequestId;
    const promise = new Promise<SetSceneResult>((resolve) => {
      this.pending.set(requestId, resolve);
    });
    this.worker.postMessage({
      type: "setScene",
      sceneKey: options.key,
      quality: options.quality,
      requestId,
    });
    return promise;
  }
}

type BackgroundHostLike = {
  attachCanvas(host: HTMLElement | null): Promise<void> | void;
  detachCanvas(host: HTMLElement | null): void;
  dispose(): void;
  setCanvasVisible(visible: boolean): void;
  setPerformanceProfile(profile: PixiBackgroundProfile): void;
  setScene(options: SceneOptions): Promise<SetSceneResult>;
};

const WORKER_FLAG =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_PIXI_BG_WORKER === "1";

const isOffscreenSupported = () => {
  if (typeof window === "undefined") return false;
  if (typeof OffscreenCanvas === "undefined") return false;
  if (typeof Worker === "undefined") return false;
  const proto = (window.HTMLCanvasElement || {}).prototype as
    | HTMLCanvasElement
    | undefined;
  return Boolean(proto && "transferControlToOffscreen" in proto);
};

const hasCrossOriginIsolation = () => {
  if (typeof window === "undefined") return false;
  return Boolean(window.crossOriginIsolated);
};

const isSafariBelow17 = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
  if (!isSafari) return false;
  const versionMatch = ua.match(/Version\/(\d+)/);
  if (!versionMatch) return false;
  const major = Number(versionMatch[1]);
  return Number.isFinite(major) && major < 17;
};

type WorkerSupportDiagnostics = {
  flag: boolean;
  offscreen: boolean;
  crossOrigin: boolean;
  safariBlocked: boolean;
  supported: boolean;
};

const computeWorkerSupport = (): WorkerSupportDiagnostics => {
  const diag: WorkerSupportDiagnostics = {
    flag: WORKER_FLAG,
    offscreen: isOffscreenSupported(),
    crossOrigin: hasCrossOriginIsolation(),
    safariBlocked: isSafariBelow17(),
    supported: false,
  };
  diag.supported = diag.flag && diag.offscreen && diag.crossOrigin && !diag.safariBlocked;
  if (typeof window !== "undefined") {
    (window as typeof window & { __pixiWorkerDiag?: WorkerSupportDiagnostics }).__pixiWorkerDiag =
      diag;
  }
  return diag;
};

const shouldPreferWorkerBackground = () => computeWorkerSupport().supported;

class PixiBackgroundHost {
  private app: Application | null = null;
  private canvasHolder: HTMLElement | null = null;
  private sceneRoot: Container | null = null;
  private current: SceneInstance | null = null;
  private canvasVisible = true;
  private initPromise: Promise<Application | null> | null = null;
  private disposeTimer: ReturnType<typeof setTimeout> | null = null;
  private requestedProfile: PixiBackgroundProfile = DEFAULT_BACKGROUND_PROFILE;
  private activeProfile: PixiBackgroundProfile = DEFAULT_BACKGROUND_PROFILE;

  private handleResize = () => {
    if (!this.app) return;
    const width = window.innerWidth || 1920;
    const height = window.innerHeight || 1080;
    this.app.renderer.resize(width, height);
    this.current?.resize(width, height);
  };

  private handleVisibility = () => {
    if (!this.app) return;
    if (document.hidden) {
      this.app.stop();
    } else {
      this.app.start();
    }
  };

  private handleContextLost = (event: Event) => {
    event.preventDefault?.();
    // Drop current scene so上位で再適用できるようにする
    this.destroyCurrentScene();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pixiBackgroundContextLost"));
    }
  };

  private handleContextRestored = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pixiBackgroundContextRestored"));
    }
  };

  private async ensureApp(): Promise<Application | null> {
    if (this.app) {
      if (this.activeProfile === this.requestedProfile) {
        this.cancelDispose();
        return this.app;
      }
      this.disposeApp();
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    const initTask = (async () => {
      const profile = this.requestedProfile;
      const app = new Application();
      try {
        const resolution =
          profile === "software"
            ? 1
            : Math.min(window.devicePixelRatio || 1, 2);
        await app.init({
          backgroundAlpha: 0,
          antialias: profile !== "software",
          resolution,
          width: window.innerWidth || 1920,
          height: window.innerHeight || 1080,
          preference: "webgl",
          powerPreference: profile === "software" ? "low-power" : "high-performance",
          hello: false,
        });
      } catch (error) {
        app.destroy(true);
        throw error;
      }

      if (this.app) {
        // 別の ensureApp が先に成功した場合は新規インスタンスを破棄する。
        app.destroy(true);
        return this.app;
      }

      app.stage.sortableChildren = true;
      if (profile === "software" && app.ticker) {
        app.ticker.maxFPS = 48;
      }
      this.sceneRoot = new Container();
      this.sceneRoot.sortableChildren = true;
      app.stage.addChild(this.sceneRoot);
      app.canvas.style.position = "absolute";
      app.canvas.style.inset = "0";
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";
      app.canvas.style.pointerEvents = "none";
      app.canvas.addEventListener("webglcontextlost", this.handleContextLost as EventListener);
      app.canvas.addEventListener("webglcontextrestored", this.handleContextRestored as EventListener);
      window.addEventListener("resize", this.handleResize, { passive: true });
      document.addEventListener("visibilitychange", this.handleVisibility);
      this.cancelDispose();
      this.app = app;
      this.activeProfile = profile;
      if (this.requestedProfile !== profile) {
        const holder = this.canvasHolder;
        this.disposeApp();
        this.canvasHolder = holder;
        return this.ensureApp();
      }
      this.reattachCanvasToHolder();
      return app;
    })();

    this.initPromise = initTask;

    try {
      return await initTask;
    } finally {
      this.initPromise = null;
    }
  }

  private reattachCanvasToHolder() {
    if (!this.app || !this.canvasHolder) return;
    if (this.app.canvas.parentElement !== this.canvasHolder) {
      this.canvasHolder.appendChild(this.app.canvas);
    }
    this.updateCanvasVisibility();
    this.handleResize();
  }

  private updateCanvasVisibility() {
    if (!this.app) return;
    this.app.canvas.style.opacity = this.canvasVisible ? "1" : "0";
  }

  setCanvasVisible(visible: boolean) {
    this.canvasVisible = visible;
    this.updateCanvasVisibility();
  }

  async attachCanvas(host: HTMLElement | null) {
    if (!host) return;
    if (this.canvasHolder && this.canvasHolder !== host && this.app && this.app.canvas.parentElement === this.canvasHolder) {
      this.canvasHolder.removeChild(this.app.canvas);
    }
    this.canvasHolder = host;
    await this.ensureApp();
    this.reattachCanvasToHolder();
    this.cancelDispose();
  }

  detachCanvas(host: HTMLElement | null) {
    if (!this.app || !host) return;
    if (this.canvasHolder === host && this.app.canvas.parentElement === host) {
      host.removeChild(this.app.canvas);
      this.canvasHolder = null;
      this.scheduleDispose();
    }
  }

  private scheduleDispose() {
    if (this.disposeTimer) return;
    const timeout = typeof window !== "undefined" ? window.setTimeout : setTimeout;
    this.disposeTimer = timeout(() => {
      this.disposeTimer = null;
      if (this.canvasHolder) {
        return;
      }
      this.disposeApp();
    }, 2000);
  }

  private cancelDispose() {
    if (!this.disposeTimer) return;
    const clear = typeof window !== "undefined" ? window.clearTimeout : clearTimeout;
    clear(this.disposeTimer);
    this.disposeTimer = null;
  }

  private disposeApp() {
    if (!this.app) return;
    this.destroyCurrentScene();
    this.canvasVisible = true;
    const canvas = this.app.canvas;
    canvas.removeEventListener("webglcontextlost", this.handleContextLost as EventListener);
    canvas.removeEventListener("webglcontextrestored", this.handleContextRestored as EventListener);
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    try {
      this.app.destroy(true);
    } catch {
      // ignore
    }
    if (this.canvasHolder && canvas.parentElement === this.canvasHolder) {
      this.canvasHolder.removeChild(canvas);
    }
    this.canvasHolder = null;
    this.sceneRoot = null;
    this.app = null;
    this.activeProfile = DEFAULT_BACKGROUND_PROFILE;
  }

  private destroyCurrentScene() {
    if (!this.current) return;
    try {
      this.sceneRoot?.removeChild(this.current.container);
      this.current.destroy();
    } catch {
      // ignore
    }
    this.current = null;
  }

  private async createSimpleScene(options: SceneOptions): Promise<SceneInstance> {
    if (!this.app || !this.sceneRoot) throw new Error("Pixi background host is not ready");
    const container = new Container();
    container.sortableChildren = true;
    container.eventMode = "none";
    this.sceneRoot.addChild(container);
    const isSoftwareProfile = (options.profile ?? this.requestedProfile) === "software";
    const controller: SimpleBackgroundController = await createSimpleBackground({
      width: this.app.renderer.width,
      height: this.app.renderer.height,
      quality: options.quality,
      backgroundColor: 0x0a0a0a,
      dprCap: isSoftwareProfile ? 1 : 2,
      onMetrics: options.onMetrics,
      app: this.app,
      container,
    });
    return {
      key: "pixi-simple",
      container,
      resize: (w: number, h: number) => controller.resize(w, h),
      destroy: () => {
        controller.destroy();
        container.destroy({ children: true });
      },
      effects: {
        lightSweep: () => controller.lightSweep(),
        updatePointerGlow: (active: boolean) => controller.updatePointerGlow(active),
        setQuality: (quality: BackgroundQuality) => controller.setQuality(quality),
      },
    };
  }

  private async createDragonQuestScene(profile: PixiBackgroundProfile): Promise<SceneInstance> {
    if (!this.app || !this.sceneRoot) throw new Error("Pixi background host is not ready");
    const container = new Container();
    container.sortableChildren = true;
    container.eventMode = "none";
    this.sceneRoot.addChild(container);
    const controller: DragonQuestBackgroundController = await createDragonQuestBackground({
      width: this.app.renderer.width,
      height: this.app.renderer.height,
      antialias: profile !== "software",
      resolution:
        profile === "software" ? 1 : Math.min(1.3, window.devicePixelRatio || 1),
      app: this.app,
      container,
      profile,
    });
    return {
      key: "pixi-dq",
      container,
      resize: (w: number, h: number) => controller.resize(w, h),
      destroy: () => {
        controller.destroy();
        container.destroy({ children: true });
      },
      effects: {
        lightSweep: () => controller.lightSweep(),
        launchFireworks: () => controller.launchFireworks(),
        launchMeteors: () => controller.launchMeteors(),
      },
    };
  }

  private async createInfernoScene(profile: PixiBackgroundProfile): Promise<SceneInstance> {
    if (!this.app || !this.sceneRoot) throw new Error("Pixi background host is not ready");
    const container = new Container();
    container.sortableChildren = true;
    container.eventMode = "none";
    this.sceneRoot.addChild(container);
    const controller: InfernoBackgroundController = await createInfernoBackground({
      width: this.app.renderer.width,
      height: this.app.renderer.height,
      antialias: profile !== "software",
      resolution:
        profile === "software" ? 1 : Math.min(1.3, window.devicePixelRatio || 1),
      app: this.app,
      container,
    });
    return {
      key: "pixi-inferno",
      container,
      resize: (w: number, h: number) => controller.resize(w, h),
      destroy: () => {
        controller.destroy();
        container.destroy({ children: true });
      },
      effects: {
        launchFireworks: () => controller.launchFireworks(),
        launchMeteors: () => controller.launchMeteors(),
        launchVolcanoEruption: controller.launchVolcanoEruption
          ? () => controller.launchVolcanoEruption?.()
          : undefined,
        flashRed: controller.flashRed
          ? (count?: number, duration?: number) => controller.flashRed?.(count, duration)
          : undefined,
      },
    };
  }

  async setScene(options: SceneOptions): Promise<SetSceneResult> {
    if (options.profile) {
      this.setPerformanceProfile(options.profile);
    }
    const profile = options.profile ?? this.requestedProfile;
    if (!this.app) {
      await this.ensureApp();
    }
    if (!this.app) {
      return { renderer: "dom", quality: options.quality };
    }
    const sameScene = this.current?.key === options.key;
    if (sameScene && options.key === "pixi-simple" && this.current?.effects.setQuality) {
      this.current.effects.setQuality(options.quality);
      return {
        renderer: "pixi",
        quality: options.quality,
        effects: this.current.effects,
      };
    }
    let next: SceneInstance | null = null;
    if (options.key === "pixi-simple") {
      next = await this.createSimpleScene(options);
    } else if (options.key === "pixi-dq") {
      next = await this.createDragonQuestScene(profile);
    } else if (options.key === "pixi-inferno") {
      next = await this.createInfernoScene(profile);
    }
    if (!next) {
      return { renderer: "dom", quality: options.quality };
    }
    this.destroyCurrentScene();
    this.current = next;
    this.setCanvasVisible(true);
    this.handleResize();
    return {
      renderer: "pixi",
      quality: options.quality,
      effects: next.effects,
    };
  }

  resetToDom(quality: BackgroundQuality): SetSceneResult {
    this.destroyCurrentScene();
    this.setCanvasVisible(false);
    this.scheduleDispose();
    return { renderer: "dom", quality };
  }

  dispose() {
    this.cancelDispose();
    this.disposeApp();
  }

  setPerformanceProfile(profile: PixiBackgroundProfile) {
    if (this.requestedProfile === profile) return;
    this.requestedProfile = profile;
    if (this.app && this.activeProfile !== profile) {
      const holder = this.canvasHolder;
      this.disposeApp();
      this.canvasHolder = holder;
    }
  }
}

class HybridPixiBackgroundHost implements BackgroundHostLike {
  private mainHost = new PixiBackgroundHost();
  private workerHost = new WorkerBackgroundHost((reason) =>
    this.switchToMain(`worker-fatal:${reason}`)
  );
  private mode: "worker" | "main" = this.workerHost.isSupported()
    ? "worker"
    : "main";
  private mountEl: HTMLElement | null = null;
  private lastVisible = true;
  private profile: PixiBackgroundProfile = DEFAULT_BACKGROUND_PROFILE;

  constructor() {
    this.exposeMode();
  }

  private exposeMode() {
    if (typeof window !== "undefined") {
      (window as typeof window & { __pixiBackgroundMode?: string }).__pixiBackgroundMode =
        this.mode;
    }
  }

  private activeHost(): BackgroundHostLike {
    return this.mode === "worker" ? this.workerHost : this.mainHost;
  }

  private switchToMain(reason?: string) {
    if (this.mode === "main") return;
    this.workerHost.dispose();
    this.mode = "main";
    this.exposeMode();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pixiBackgroundContextLost", {
          detail: { reason: reason ?? "worker-fallback" },
        })
      );
    }
    if (this.mountEl) {
      this.mainHost.attachCanvas(this.mountEl);
      this.mainHost.setPerformanceProfile(this.profile);
      this.mainHost.setCanvasVisible(this.lastVisible);
    }
  }

  setCanvasVisible(visible: boolean) {
    this.lastVisible = visible;
    this.activeHost().setCanvasVisible(visible);
  }

  async attachCanvas(host: HTMLElement | null) {
    this.mountEl = host;
    if (this.mode === "worker") {
      try {
        await this.workerHost.attachCanvas(host);
        if (host) this.mainHost.detachCanvas(host);
        return;
      } catch {
        this.switchToMain("attach-error");
      }
    }
    await this.mainHost.attachCanvas(host);
  }

  detachCanvas(host: HTMLElement | null) {
    this.activeHost().detachCanvas(host);
    if (this.mountEl === host) {
      this.mountEl = null;
    }
  }

  dispose() {
    this.workerHost.dispose();
    this.mainHost.dispose();
  }

  setPerformanceProfile(profile: PixiBackgroundProfile) {
    this.profile = profile;
    this.workerHost.setPerformanceProfile(profile);
    this.mainHost.setPerformanceProfile(profile);
  }

  async setScene(options: SceneOptions): Promise<SetSceneResult> {
    if (this.mode === "worker") {
      try {
        const result = await this.workerHost.setScene(options);
        if (typeof window !== "undefined") {
          (window as typeof window & { __pixiLastSceneResult?: SetSceneResult }).__pixiLastSceneResult =
            result;
        }

        // If the worker failed to produce a Pixi renderer (e.g., WebGL unavailable
        // so Pixi falls back to the unimplemented CanvasRenderer), immediately
        // retry on the main-thread host so we don't get stuck on CSS fallback.
        if (result.renderer !== "pixi") {
          this.switchToMain("worker-renderer-dom");
        } else {
          return result;
        }
      } catch {
        this.switchToMain("scene-error");
      }
    }
    const result = await this.mainHost.setScene(options);
    if (typeof window !== "undefined") {
      (window as typeof window & { __pixiLastSceneResult?: SetSceneResult }).__pixiLastSceneResult =
        result;
    }
    return result;
  }
}

export const pixiBackgroundHost = new HybridPixiBackgroundHost();
