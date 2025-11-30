/* eslint-disable no-restricted-globals */
import {
  Application,
  Container,
  DOMAdapter,
  Graphics,
  WebWorkerAdapter,
  Color,
  Ticker,
} from "pixi.js";
import {
  createDragonQuestBackground,
  type DragonQuestBackgroundController,
} from "./dragonQuestBackground";
import {
  createInfernoBackground,
  type InfernoBackgroundController,
} from "./infernoBackground";

type PixiSceneKey = "pixi-simple" | "pixi-dq" | "pixi-inferno";
type BackgroundQuality = "low" | "med" | "high";
type PixiBackgroundProfile = "default" | "software";

type IncomingMessage =
  | {
      type: "init";
      width: number;
      height: number;
      canvas: OffscreenCanvas;
      profile: PixiBackgroundProfile;
      requestId?: number;
    }
  | {
      type: "setScene";
      sceneKey: PixiSceneKey;
      quality: BackgroundQuality;
      requestId?: number;
    }
  | { type: "resize"; width: number; height: number }
  | {
      type: "effect";
      effect:
        | "lightSweep"
        | "fireworks"
        | "meteors"
        | "infernoVolcano"
        | "flashRed"
        | "flashWhite";
      count?: number;
      duration?: number;
    }
  | { type: "terminate" }
  | { type: "setProfile"; profile: PixiBackgroundProfile }
  | { type: "pageVisibility"; visible: boolean };

type SceneEffects = {
  lightSweep?: () => void;
  launchFireworks?: () => void;
  launchMeteors?: () => void;
  launchVolcanoEruption?: () => void;
  flashRed?: (count?: number, duration?: number) => void;
  flashWhite?: (duration?: number) => void;
};

type SceneController = {
  key: PixiSceneKey;
  container: Container;
  resize: (w: number, h: number) => void;
  destroy: () => void;
  effects: SceneEffects;
};

type OutgoingMessage =
  | { type: "ready"; requestId?: number }
  | { type: "scene-ready"; requestId?: number; quality: BackgroundQuality }
  | { type: "error"; requestId?: number; message: string }
  | { type: "fallback"; reason: string }
  | { type: "context-lost"; count: number }
  | { type: "debug"; message: string; detail?: unknown };

if (typeof globalThis.requestAnimationFrame === "undefined") {
  const rafIds = new Map<number, ReturnType<typeof setTimeout>>();
  let rafSeed = 0;
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    rafSeed += 1;
    const handle = setTimeout(() => {
      rafIds.delete(rafSeed);
      callback(globalThis.performance?.now?.() ?? Date.now());
    }, 16);
    rafIds.set(rafSeed, handle);
    return rafSeed;
  };
  globalThis.cancelAnimationFrame = (handle: number) => {
    const timeoutHandle = rafIds.get(handle);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      rafIds.delete(handle);
    }
  };
}

DOMAdapter.set(WebWorkerAdapter);

let app: Application | null = null;
let stageRoot: Container | null = null;
let currentScene: SceneController | null = null;
let currentSceneMeta: { key: PixiSceneKey; quality: BackgroundQuality } | null = null;
let canvasRef: OffscreenCanvas | null = null;
let lastWidth = 0;
let lastHeight = 0;
let currentProfile: PixiBackgroundProfile = "default";
let contextLostCount = 0;
let pageVisible = true;
let recovering = false;

type WorkerGlobal = typeof globalThis & {
  postMessage: (message: OutgoingMessage, transfer?: Transferable[]) => void;
};

const workerGlobal = self as WorkerGlobal;
const ENABLE_DEBUG_LOG = process.env.NODE_ENV !== "production";

const post = (message: OutgoingMessage) => {
  workerGlobal.postMessage(message);
};

const debug = (message: string, detail?: unknown) => {
  if (!ENABLE_DEBUG_LOG) {
    return;
  }
  post({ type: "debug", message, detail });
};

const disposeApp = () => {
  try {
    currentScene?.destroy();
    currentScene = null;
    currentSceneMeta = null;
    stageRoot?.destroy({ children: true });
    stageRoot = null;
    app?.destroy(true);
  } catch {
    // noop
  } finally {
    app = null;
  }
};

const updateTickerForVisibility = () => {
  if (!app) return;
  if (pageVisible) {
    app.ticker.maxFPS = currentProfile === "software" ? 50 : 60;
    app.ticker.start();
  } else {
    // 負荷を抑えるために非表示時は完全停止
    app.ticker.maxFPS = 12;
    app.ticker.stop();
  }
};

const createSimpleScene = (
  quality: BackgroundQuality,
  baseColor: number,
  accentColor: number
): SceneController => {
  if (!app || !stageRoot) throw new Error("Application not initialized");
  const container = new Container();
  const background = new Graphics();
  const gradient = new Graphics();
  const stars = new Container();
  const fireworkContainer = new Container();
  const meteorContainer = new Container();
  const overlay = new Graphics();
  const width = app.renderer.width;
  const height = app.renderer.height;

  const rebuildBackground = (w: number, h: number) => {
    background.clear();
    background.rect(0, 0, w, h);
    background.fill({ color: baseColor });

    gradient.clear();
    gradient.rect(0, 0, w, h);
    gradient.fill({
      color: accentColor,
      alpha: 0.35,
    });
    gradient.alpha = 0.55;

    overlay.clear();
    overlay.rect(0, 0, w, h);
    overlay.fill({ color: 0xffffff, alpha: 0 });
  };

  rebuildBackground(width, height);

  const starCount = quality === "high" ? 220 : quality === "med" ? 150 : 90;
  for (let i = 0; i < starCount; i += 1) {
    const star = new Graphics();
    const size = Math.random() * 1.2 + 0.2;
    star.circle(0, 0, size);
    star.fill({
      color: 0xffffff,
      alpha: 0.5 + Math.random() * 0.4,
    });
    star.x = Math.random() * width;
    star.y = Math.random() * height;
    (star as Graphics & { __twinkle?: number }).__twinkle =
      Math.random() * Math.PI * 2;
    stars.addChild(star);
  }

  stageRoot.addChild(container);
  container.addChild(background);
  container.addChild(gradient);
  container.addChild(stars);
  container.addChild(fireworkContainer);
  container.addChild(meteorContainer);
  container.addChild(overlay);

  type Firework = {
    sprite: Graphics;
    vx: number;
    vy: number;
    life: number;
  };
  const fireworks: Firework[] = [];

  type Meteor = { sprite: Graphics; vx: number; vy: number; life: number };
  const meteors: Meteor[] = [];
  let sweepTime = 0;
  let flashTime = 0;
  let flashTint = new Color(0xff3322);

  const launchFireworks = () => {
    const bursts = quality === "high" ? 3 : 1;
    for (let i = 0; i < bursts; i += 1) {
      const sprite = new Graphics();
      sprite.circle(0, 0, 2 + Math.random() * 2.5);
      sprite.fill({ color: 0xffe066, alpha: 0.9 });
      sprite.x = width * (0.25 + Math.random() * 0.5);
      sprite.y = height * 0.9;
      const vx = (Math.random() - 0.5) * 1.5;
      const vy = -4.2 - Math.random() * 2.5;
      fireworks.push({
        sprite,
        vx,
        vy,
        life: 1.1 + Math.random() * 0.4,
      });
      fireworkContainer.addChild(sprite);
    }
  };

  const launchMeteors = () => {
    const count = quality === "high" ? 4 : 2;
    for (let i = 0; i < count; i += 1) {
      const sprite = new Graphics();
      sprite.rect(-40, -2, 80, 4);
      sprite.fill({ color: 0xff9966, alpha: 0.9 });
      sprite.rotation = -0.6;
      sprite.x = -40;
      sprite.y = Math.random() * height * 0.6;
      meteors.push({
        sprite,
        vx: 24 + Math.random() * 6,
        vy: 4 + Math.random() * 2,
        life: 1.2,
      });
      meteorContainer.addChild(sprite);
    }
  };

  const lightSweep = () => {
    sweepTime = 800;
  };
  const flashRed = (count = 1, duration = 220) => {
    flashTint = new Color(0xff3322);
    flashTime = Math.max(flashTime, count * duration);
  };

  const flashWhite = (duration = 140) => {
    flashTint = new Color(0xffffff);
    flashTime = Math.max(flashTime, Math.max(50, duration));
  };

  const ticker = (tickerInstance: Ticker) => {
    const dt = tickerInstance.deltaMS / 16.6667;
    stars.children.forEach((child) => {
      const star = child as Graphics & { __twinkle?: number };
      if (typeof star.__twinkle === "number") {
        star.__twinkle += dt * 0.4;
        star.alpha = 0.35 + Math.sin(star.__twinkle) * 0.25;
      }
    });

    for (let i = fireworks.length - 1; i >= 0; i -= 1) {
      const fw = fireworks[i];
      fw.sprite.x += fw.vx * dt;
      fw.sprite.y += fw.vy * dt * 3;
      fw.vy += 0.18 * dt;
      fw.life -= 0.015 * dt * 60;
      fw.sprite.alpha = Math.max(0, fw.life);
      if (fw.life <= 0) {
        fireworkContainer.removeChild(fw.sprite);
        fw.sprite.destroy();
        fireworks.splice(i, 1);
      }
    }

    for (let i = meteors.length - 1; i >= 0; i -= 1) {
      const m = meteors[i];
      m.sprite.x += m.vx * dt;
      m.sprite.y += m.vy * dt;
      m.life -= 0.02 * dt * 60;
      m.sprite.alpha = Math.max(0, m.life);
      if (m.life <= 0 || m.sprite.x > width + 120) {
        meteorContainer.removeChild(m.sprite);
        m.sprite.destroy();
        meteors.splice(i, 1);
      }
    }

    if (sweepTime > 0) {
      sweepTime -= dt * 1000;
      const t = Math.max(0, sweepTime) / 800;
      gradient.position.x = Math.sin((1 - t) * Math.PI) * width * 0.08;
      gradient.alpha = 0.2 + t * 0.4;
    } else {
      gradient.position.x *= 0.9;
      gradient.alpha += (0.55 - gradient.alpha) * 0.1;
    }

    if (flashTime > 0) {
      flashTime -= dt * 1000;
      overlay.alpha = Math.min(0.75, flashTime / 220);
      overlay.tint = flashTint;
    } else {
      overlay.alpha *= 0.9;
    }
  };

  app.ticker.add(ticker);

  return {
    key: "pixi-simple",
    container,
    resize: (w: number, h: number) => {
      rebuildBackground(w, h);
    },
    destroy: () => {
      app?.ticker.remove(ticker);
      meteors.forEach((m) => m.sprite.destroy());
      fireworks.forEach((f) => f.sprite.destroy());
      container.destroy({ children: true });
    },
    effects: {
      lightSweep,
      launchFireworks,
      launchMeteors,
      flashRed,
      flashWhite,
    },
  };
};

const createDragonQuestScene = async (
  profile: PixiBackgroundProfile
): Promise<SceneController> => {
  if (!app || !stageRoot) throw new Error("Application not initialized");
  const container = new Container();
  container.sortableChildren = true;
  container.eventMode = "none";
  stageRoot.addChild(container);
  const resolution =
    profile === "software"
      ? 1
      : Math.min(globalThis.devicePixelRatio ?? 1, 1.3);
  const controller: DragonQuestBackgroundController =
    await createDragonQuestBackground({
      width: app.renderer.width,
      height: app.renderer.height,
      antialias: profile !== "software",
      resolution,
      app,
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
      flashWhite: controller.flashWhite
        ? (duration?: number) => controller.flashWhite?.(duration)
        : undefined,
    },
  };
};

const createInfernoScene = async (
  profile: PixiBackgroundProfile
): Promise<SceneController> => {
  if (!app || !stageRoot) throw new Error("Application not initialized");
  const container = new Container();
  container.sortableChildren = true;
  container.eventMode = "none";
  stageRoot.addChild(container);
  const resolution =
    profile === "software"
      ? 1
      : Math.min(globalThis.devicePixelRatio ?? 1, 1.3);
  const controller: InfernoBackgroundController = await createInfernoBackground({
    width: app.renderer.width,
    height: app.renderer.height,
    antialias: profile !== "software",
    resolution,
    app,
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
      launchVolcanoEruption: () => controller.launchVolcanoEruption(),
      flashRed: controller.flashRed
        ? (count?: number, duration?: number) => controller.flashRed?.(count, duration)
        : undefined,
      flashWhite: controller.flashWhite
        ? (duration?: number) => controller.flashWhite?.(duration)
        : undefined,
    },
  };
};

const setScene = async (
  sceneKey: PixiSceneKey,
  quality: BackgroundQuality
) => {
  if (!app || !stageRoot) throw new Error("Pixi worker app not ready");
  debug("setScene:start", { sceneKey, quality });
  let next: SceneController | null = null;
  if (sceneKey === "pixi-simple") {
    const baseColor = 0x0a0d14;
    const accentColor = 0x0f2038;
    next = createSimpleScene(quality, baseColor, accentColor);
  } else if (sceneKey === "pixi-dq") {
    next = await createDragonQuestScene(currentProfile);
  } else if (sceneKey === "pixi-inferno") {
    next = await createInfernoScene(currentProfile);
  }
  if (!next) {
    next = createSimpleScene(quality, 0x0a0d14, 0x0f2038);
  }
  if (currentScene) {
    if (stageRoot.children.includes(currentScene.container)) {
      stageRoot.removeChild(currentScene.container);
    }
    currentScene.destroy();
  }
  currentScene = next;
  currentSceneMeta = { key: next.key, quality };
  debug("setScene:attached", { sceneKey: next.key });
};

const ensureApp = async (
  canvas: OffscreenCanvas,
  width: number,
  height: number,
  profile: PixiBackgroundProfile
) => {
  canvasRef = canvas;
  lastWidth = width;
  lastHeight = height;
  currentProfile = profile;
  app = new Application();
  await app.init({
    view: canvas as unknown as HTMLCanvasElement,
    backgroundAlpha: 0,
    antialias: profile !== "software",
    resolution: profile === "software" ? 1 : Math.min(self.devicePixelRatio || 1, 1.6),
    width,
    height,
    preference: "webgl",
    powerPreference: profile === "software" ? "low-power" : "high-performance",
    hello: false,
  });
  updateTickerForVisibility();
  stageRoot = new Container();
  stageRoot.sortableChildren = true;
  app.stage.addChild(stageRoot);

  const view = app.renderer.view as unknown as OffscreenCanvas;
  if (view && "addEventListener" in view) {
    view.addEventListener("webglcontextlost", (event: Event) => {
      event.preventDefault?.();
      contextLostCount += 1;
      post({ type: "context-lost", count: contextLostCount });
      if (contextLostCount >= 3) {
        post({ type: "fallback", reason: "context-lost-loop" });
        return;
      }
      // Try to再初期化して黒画面を避ける
      setTimeout(() => {
        void reinitializeApp("context-lost");
      }, 80);
    });
    view.addEventListener("webglcontextrestored", () => {
      contextLostCount = 0;
    });
  }
};

async function reinitializeApp(reason?: string) {
  if (recovering || !canvasRef) return;
  recovering = true;
  debug("reinit:start", { reason, profile: currentProfile });
  try {
    disposeApp();
    await ensureApp(canvasRef, lastWidth, lastHeight, currentProfile);
    if (currentSceneMeta) {
      await setScene(currentSceneMeta.key, currentSceneMeta.quality);
    }
    debug("reinit:done", { reason });
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  } finally {
    recovering = false;
  }
}

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case "init":
        debug("init:start", { width: msg.width, height: msg.height, profile: msg.profile });
        disposeApp();
        await ensureApp(msg.canvas, msg.width, msg.height, msg.profile);
        debug("init:ready");
        post({ type: "ready", requestId: msg.requestId });
        break;
      case "setScene":
        await setScene(msg.sceneKey, msg.quality);
        post({
          type: "scene-ready",
          requestId: msg.requestId,
          quality: msg.quality,
        });
        debug("setScene:ready", { sceneKey: msg.sceneKey });
        break;
      case "resize":
        if (app) {
          lastWidth = msg.width;
          lastHeight = msg.height;
          app.renderer.resize(msg.width, msg.height);
          currentScene?.resize(msg.width, msg.height);
        }
        break;
      case "effect":
        if (!currentScene) return;
        if (msg.effect === "lightSweep") currentScene.effects.lightSweep?.();
        if (msg.effect === "fireworks") currentScene.effects.launchFireworks?.();
        if (msg.effect === "meteors") currentScene.effects.launchMeteors?.();
        if (msg.effect === "infernoVolcano") {
          currentScene.effects.launchVolcanoEruption?.();
        }
        if (msg.effect === "flashRed") {
          debug("effect:flashRed", {
            scene: currentScene.key,
            count: msg.count,
            duration: msg.duration,
          });
          currentScene.effects.flashRed?.(msg.count, msg.duration);
        }
        if (msg.effect === "flashWhite") {
          debug("effect:flashWhite", {
            scene: currentScene.key,
            duration: msg.duration,
          });
          currentScene.effects.flashWhite?.(msg.duration);
        }
        break;
      case "setProfile":
        currentProfile = msg.profile;
        break;
      case "pageVisibility":
        pageVisible = msg.visible;
        updateTickerForVisibility();
        break;
      case "terminate":
        disposeApp();
        close();
        break;
      default:
        post({ type: "error", message: "unknown message" });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown worker error";
    const requestId = "requestId" in msg ? msg.requestId : undefined;
    post({ type: "error", requestId, message });
  }
};
