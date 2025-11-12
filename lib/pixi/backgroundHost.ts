import { Application, Container } from "@/lib/pixi/instance";
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

type SceneOptions = {
  key: PixiSceneKey;
  quality: BackgroundQuality;
  onMetrics?: (metrics: SimpleBackgroundMetrics) => void;
};

class PixiBackgroundHost {
  private app: Application | null = null;
  private canvasHolder: HTMLElement | null = null;
  private sceneRoot: Container | null = null;
  private current: SceneInstance | null = null;
  private canvasVisible = true;
  private initPromise: Promise<Application | null> | null = null;
  private disposeTimer: ReturnType<typeof setTimeout> | null = null;

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
  };

  private handleContextRestored = () => {
    // 現状では controller 側で再構築が不要だが、必要に応じて追加する。
  };

  private async ensureApp(): Promise<Application | null> {
    if (this.app) {
      this.cancelDispose();
      return this.app;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    const initTask = (async () => {
      const app = new Application();
      try {
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          width: window.innerWidth || 1920,
          height: window.innerHeight || 1080,
          preference: "webgl",
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
      return app;
    })();

    this.initPromise = initTask;

    try {
      return await initTask;
    } finally {
      this.initPromise = null;
    }
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
    await this.ensureApp();
    if (!this.app) return;
    if (this.canvasHolder === host) return;
    if (this.canvasHolder && this.app.canvas.parentElement === this.canvasHolder) {
      this.canvasHolder.removeChild(this.app.canvas);
    }
    this.canvasHolder = host;
    host.appendChild(this.app.canvas);
    this.updateCanvasVisibility();
    this.handleResize();
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
    const controller: SimpleBackgroundController = await createSimpleBackground({
      width: this.app.renderer.width,
      height: this.app.renderer.height,
      quality: options.quality,
      backgroundColor: 0x0a0a0a,
      dprCap: 2,
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

  private async createDragonQuestScene(): Promise<SceneInstance> {
    if (!this.app || !this.sceneRoot) throw new Error("Pixi background host is not ready");
    const container = new Container();
    container.sortableChildren = true;
    container.eventMode = "none";
    this.sceneRoot.addChild(container);
    const controller: DragonQuestBackgroundController = await createDragonQuestBackground({
      width: this.app.renderer.width,
      height: this.app.renderer.height,
      antialias: true,
      resolution: Math.min(1.3, window.devicePixelRatio || 1),
      app: this.app,
      container,
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

  private async createInfernoScene(): Promise<SceneInstance> {
    if (!this.app || !this.sceneRoot) throw new Error("Pixi background host is not ready");
    const container = new Container();
    container.sortableChildren = true;
    container.eventMode = "none";
    this.sceneRoot.addChild(container);
    const controller: InfernoBackgroundController = await createInfernoBackground({
      width: this.app.renderer.width,
      height: this.app.renderer.height,
      antialias: true,
      resolution: Math.min(1.3, window.devicePixelRatio || 1),
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
      next = await this.createDragonQuestScene();
    } else if (options.key === "pixi-inferno") {
      next = await this.createInfernoScene();
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
}

export const pixiBackgroundHost = new PixiBackgroundHost();
