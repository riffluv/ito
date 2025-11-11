import type * as PIXI from "pixi.js";
import { loadPixi } from "./loadPixi";

export type BackgroundQuality = "low" | "med" | "high";

export interface SimpleBackgroundMetrics {
  fps?: number;
  frameTimeP95?: number;
  fallback?: boolean;
}

export interface SimpleBackgroundOptions {
  width: number;
  height: number;
  quality: BackgroundQuality;
  backgroundColor?: number;
  dprCap?: number;
  onMetrics?: (metrics: SimpleBackgroundMetrics) => void;
  app?: PIXI.Application;
  container?: PIXI.Container;
}

export interface SimpleBackgroundController {
  canvas?: HTMLCanvasElement;
  destroy(): void;
  resize(width: number, height: number): void;
  setQuality(quality: BackgroundQuality): void;
  lightSweep(): void;
  updatePointerGlow(active: boolean): void;
}

const DEFAULT_BACKGROUND = 0x0a0a0a;
const DPR_CAP = 2;
const LIGHT_SWEEP_DURATION_MS = 1100;

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const createVignetteTexture = (
  pixi: typeof PIXI,
  size = 512
): PIXI.Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create vignette texture context");
  }

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.2,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.7, "rgba(0,0,0,0.08)");
  gradient.addColorStop(1, "rgba(0,0,0,0.55)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return pixi.Texture.from(canvas);
};

const createGrainTexture = (
  pixi: typeof PIXI,
  size = 128
): PIXI.Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create grain texture context");
  }

  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = 110 + Math.random() * 85;
    data[i] = noise;
    data[i + 1] = noise;
    data[i + 2] = noise;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  return pixi.Texture.from(canvas);
};

const createLightSweepTexture = (
  pixi: typeof PIXI,
  width = 768,
  height = 256
): PIXI.Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create light sweep texture context");
  }

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.04)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.25)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.04)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return pixi.Texture.from(canvas);
};

const createPointerGlowTexture = (
  pixi: typeof PIXI,
  radius = 256
): PIXI.Texture => {
  const size = radius * 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create pointer glow texture context");
  }
  const gradient = ctx.createRadialGradient(
    radius,
    radius,
    0,
    radius,
    radius,
    radius
  );
  gradient.addColorStop(0, "rgba(255,255,255,0.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return pixi.Texture.from(canvas);
};

const createDiagonalGradientTexture = (
  pixi: typeof PIXI,
  width = 1024,
  height = 1024,
  stops: Array<{ offset: number; color: string }> = [
    { offset: 0, color: "rgba(28, 65, 120, 0.25)" },
    { offset: 0.45, color: "rgba(18, 35, 80, 0.18)" },
    { offset: 1, color: "rgba(8, 12, 24, 0)" },
  ]
): PIXI.Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create diagonal gradient texture context");
  }

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  stops.forEach((stop) => {
    gradient.addColorStop(stop.offset, stop.color);
  });
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return pixi.Texture.from(canvas);
};

export async function createSimpleBackground(
  options: SimpleBackgroundOptions
): Promise<SimpleBackgroundController> {
  const pixi = await loadPixi();
  const ownsApp = !options.app;
  const app = options.app ?? new pixi.Application();
  const resolution = Math.min(
    options.dprCap ?? DPR_CAP,
    typeof window !== "undefined" && window.devicePixelRatio
      ? window.devicePixelRatio
      : 1
  );

  if (ownsApp) {
    await app.init({
      width: options.width,
      height: options.height,
      backgroundColor: options.backgroundColor ?? DEFAULT_BACKGROUND,
      antialias: true,
      resolution,
      autoDensity: false,
      powerPreference: "low-power",
    });

    if (!app.canvas) {
      throw new Error("Pixi canvas is unavailable");
    }

    app.canvas.style.width = `${options.width}px`;
    app.canvas.style.height = `${options.height}px`;
    app.canvas.style.position = "absolute";
    app.canvas.style.top = "0";
    app.canvas.style.left = "0";
    app.canvas.style.pointerEvents = "none";
  }

  let detachRoot: (() => void) | null = null;
  const root = options.container ?? new pixi.Container();
  root.eventMode = "none";
  root.sortableChildren = true;
  if (!options.container) {
    app.stage.addChildAt(root, 0);
    detachRoot = () => {
      if (root.parent) {
        root.parent.removeChild(root);
      }
      root.destroy({ children: true });
    };
  } else {
    root.removeChildren();
  }
  const parallaxLayers: Array<{
    display: PIXI.Container;
    depthX: number;
    depthY: number;
    baseX: number;
    baseY: number;
  }> = [];

  const baseRect = new pixi.Graphics();
  baseRect.rect(0, 0, options.width, options.height);
  baseRect.fill(options.backgroundColor ?? DEFAULT_BACKGROUND);
  baseRect.cacheAsBitmap = true;
  root.addChild(baseRect);

  const diagonalOverlay = new pixi.Sprite(
    createDiagonalGradientTexture(pixi)
  );
  diagonalOverlay.anchor.set(0.5);
  diagonalOverlay.alpha = 0.24;
  diagonalOverlay.blendMode = "screen";
  root.addChild(diagonalOverlay);
  parallaxLayers.push({
    display: diagonalOverlay,
    depthX: 0.035,
    depthY: 0.02,
    baseX: 0,
    baseY: 0,
  });

  const softAurora = new pixi.Sprite(createPointerGlowTexture(pixi, 480));
  softAurora.anchor.set(0.5);
  softAurora.alpha = 0.12;
  softAurora.blendMode = "add";
  root.addChild(softAurora);
  parallaxLayers.push({
    display: softAurora,
    depthX: 0.06,
    depthY: 0.05,
    baseX: 0,
    baseY: 0,
  });

  const vignette = new pixi.Sprite(createVignetteTexture(pixi));
  vignette.alpha = 0.15;
  vignette.blendMode = "multiply";
  vignette.anchor.set(0.5);
  root.addChild(vignette);

  const grainTexture = createGrainTexture(pixi);
  grainTexture.baseTexture.wrapMode = "repeat";
  const grain = new pixi.TilingSprite(
    grainTexture,
    options.width,
    options.height
  );
  grain.alpha = 0.065;
  grain.blendMode = "screen";
  root.addChild(grain);

  const lightSweepTexture = createLightSweepTexture(pixi);
  const lightSweep = new pixi.Sprite(lightSweepTexture);
  lightSweep.anchor.set(0.5);
  lightSweep.blendMode = "screen";
  lightSweep.alpha = 0;
  lightSweep.visible = false;
  root.addChild(lightSweep);

  const pointerGlow = new pixi.Sprite(createPointerGlowTexture(pixi));
  pointerGlow.anchor.set(0.5);
  pointerGlow.blendMode = "screen";
  pointerGlow.alpha = 0;
  pointerGlow.visible = false;
  root.addChild(pointerGlow);

  let pointerTargetX = 0;
  let pointerTargetY = 0.08;
  let pointerCurrentX = 0;
  let pointerCurrentY = 0;

  let running = false;
  let rafId: number | null = null;
  let quality: BackgroundQuality = options.quality;
  let sweepActive = false;
  let sweepStart = 0;
  let pointerGlowActive = false;
  let pointerGlowProgress = 0;
  let lastMetricsLog = performance.now();

  const animationState = {
    grainSpeed: 0.12,
    parallaxPhase: 0,
    parallaxSpeed: 0.08,
  };

  const setPointerTarget = (x: number, y: number) => {
    const clampedX = Math.max(-1, Math.min(1, x));
    const clampedY = Math.max(-1, Math.min(1, y));
    pointerTargetX = clampedX;
    pointerTargetY = clampedY;
  };


  const renderNow = () => {
    if (ownsApp) {
      app.renderer.render(app.stage);
    }
  };

  const applyLayout = (width: number, height: number) => {
    baseRect.clear();
    baseRect.rect(0, 0, width, height);
    baseRect.fill(options.backgroundColor ?? DEFAULT_BACKGROUND);

    diagonalOverlay.width = width * 1.6;
    diagonalOverlay.height = height * 1.25;
    diagonalOverlay.position.set(width / 2, height / 2);

    softAurora.width = width * 1.05;
    softAurora.height = height * 0.75;
    softAurora.position.set(width / 2, height * 0.78);

    vignette.width = width * 1.2;
    vignette.height = height * 1.2;
    vignette.position.set(width / 2, height / 2);

    grain.width = width;
    grain.height = height;

    lightSweep.width = Math.hypot(width, height) * 1.1;
    lightSweep.height = Math.max(width, height) * 0.35;
    lightSweep.rotation = -0.38;
    lightSweep.position.set(width / 2, height / 2);

    pointerGlow.position.set(width / 2, height * 0.92);
    pointerGlow.width = width * 0.6;
    pointerGlow.height = width * 0.18;

    parallaxLayers.forEach((layer) => {
      if (layer.display.position) {
        layer.baseX = layer.display.position.x;
        layer.baseY = layer.display.position.y;
      } else {
        layer.baseX = 0;
        layer.baseY = 0;
      }
    });

    if (ownsApp) {
      app.renderer.resize(width, height);
      if (app.canvas) {
        app.canvas.style.width = `${width}px`;
        app.canvas.style.height = `${height}px`;
      }
    }
    renderNow();
  };

  applyLayout(options.width, options.height);

  const stopLoop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    running = false;
  };

  const scheduleLoop = () => {
    if (running) return;
    running = true;
    let lastTime = performance.now();
    let lastRender = lastTime;
    const maxFps = quality === "high" ? 60 : 30;
    const minFrameInterval = 1000 / maxFps;

    const tick = () => {
      if (!running) {
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(tick);

      const currentTime = performance.now();
      const delta = currentTime - lastTime;
      lastTime = currentTime;

      let needsRender = false;

      if (quality !== "low") {
        animationState.grainSpeed = quality === "high" ? 0.18 : 0.08;
        grain.tilePosition.x += animationState.grainSpeed * delta;
        grain.tilePosition.y += animationState.grainSpeed * delta * 0.45;
        needsRender = true;
      }

      if (quality === "high") {
        animationState.parallaxPhase += delta * animationState.parallaxSpeed;
        const rotation = Math.sin(animationState.parallaxPhase * 0.002) * 0.0025;
        root.pivot.set(app.screen.width / 2, app.screen.height / 2);
        root.position.set(app.screen.width / 2, app.screen.height / 2);
        root.rotation = rotation;
        needsRender = true;
      } else if (root.rotation !== 0) {
        root.rotation = 0;
        root.pivot.set(0, 0);
        root.position.set(0, 0);
        needsRender = true;
      }

      const prevPointerX = pointerCurrentX;
      const prevPointerY = pointerCurrentY;
      pointerCurrentX += (pointerTargetX - pointerCurrentX) * 0.08;
      pointerCurrentY += (pointerTargetY - pointerCurrentY) * 0.1;
      parallaxLayers.forEach((layer) => {
        const offsetX = pointerCurrentX * app!.screen.width * layer.depthX;
        const offsetY = pointerCurrentY * app!.screen.height * layer.depthY;
        layer.display.position.set(layer.baseX + offsetX, layer.baseY + offsetY);
      });
      if (
        Math.abs(pointerCurrentX - prevPointerX) > 0.0005 ||
        Math.abs(pointerCurrentY - prevPointerY) > 0.0005
      ) {
        needsRender = true;
      }

      if (pointerGlowActive) {
        pointerGlowProgress += delta / 200;
        const eased = easeInOut(Math.min(pointerGlowProgress, 1));
        pointerGlow.alpha = eased * 0.08;
        pointerGlow.visible = true;
        if (pointerGlowProgress >= 1) {
          pointerGlowActive = false;
        }
        needsRender = true;
      } else if (pointerGlow.alpha > 0) {
        pointerGlow.alpha = Math.max(0, pointerGlow.alpha - delta / 300);
        pointerGlow.visible = pointerGlow.alpha > 0.001;
        needsRender = true;
      }

      if (sweepActive) {
        const elapsed = currentTime - sweepStart;
        const t = Math.min(1, elapsed / LIGHT_SWEEP_DURATION_MS);
        const eased = easeInOut(t);
        lightSweep.position.x =
          app.screen.width * (-0.3 + eased * 1.6);
        lightSweep.alpha = 0.22 * Math.sin(Math.PI * t);
        lightSweep.visible = true;
        needsRender = true;
        if (elapsed >= LIGHT_SWEEP_DURATION_MS) {
          sweepActive = false;
          lightSweep.visible = false;
          lightSweep.alpha = 0;
        }
      }

      if (needsRender && currentTime - lastRender >= minFrameInterval) {
        renderNow();
        lastRender = currentTime;
      } else if (!needsRender && quality === "low" && !sweepActive) {
        stopLoop();
      }

      if (options.onMetrics && currentTime - lastMetricsLog > 5000) {
        lastMetricsLog = currentTime;
        options.onMetrics({
          frameTimeP95: minFrameInterval,
        });
      }
    };

    rafId = requestAnimationFrame(tick);
  };

  const controller: SimpleBackgroundController = {
    canvas: ownsApp ? app.canvas ?? undefined : undefined,
    destroy() {
      stopLoop();
      pointerGlowActive = false;
      sweepActive = false;
      if (ownsApp) {
        try {
          root.removeChildren();
          app.destroy(true);
        } catch {
          // noop
        }
      } else if (options.container) {
        options.container.removeChildren();
      }
      if (detachRoot) {
        detachRoot();
        detachRoot = null;
      }
    },
    resize(width: number, height: number) {
      applyLayout(width, height);
      scheduleLoop();
    },
    setQuality(nextQuality: BackgroundQuality) {
      if (quality === nextQuality) return;
      quality = nextQuality;
      if (quality === "low") {
        root.rotation = 0;
        root.pivot.set(0, 0);
        root.position.set(0, 0);
      }
      scheduleLoop();
    },
    lightSweep() {
      sweepActive = true;
      sweepStart = performance.now();
      lightSweep.visible = true;
      pointerGlowActive = false;
      pointerGlowProgress = 0;
      setPointerTarget(0, -0.04);
      scheduleLoop();
    },
    updatePointerGlow(active: boolean) {
      if (active) {
        pointerGlowActive = true;
        pointerGlowProgress = 0;
        setPointerTarget(pointerTargetX * 0.6, -0.08);
        scheduleLoop();
      } else {
        setPointerTarget(pointerTargetX * 0.4, 0.08);
        scheduleLoop();
      }
    },
  };

  scheduleLoop();

  return controller;
}
