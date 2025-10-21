import type * as PIXI from "pixi.js";

export interface RichBlackBackgroundOptions {
  width: number;
  height: number;
  animate?: boolean;
  resolution?: number;
  vignetteAlpha?: number;
  noiseAlpha?: number;
}

export interface RichBlackBackgroundController {
  canvas: HTMLCanvasElement;
  resize(width: number, height: number): void;
  destroy(): void;
}

const DEFAULT_COLOR_TOP = "#0c0f16";
const DEFAULT_COLOR_MID = "#04060b";
const DEFAULT_COLOR_BOTTOM = "#010103";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const createGradientTexture = (pixi: typeof PIXI) => {
  const width = 512;
  const height = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create gradient context");
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, DEFAULT_COLOR_TOP);
  gradient.addColorStop(0.5, DEFAULT_COLOR_MID);
  gradient.addColorStop(1, DEFAULT_COLOR_BOTTOM);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return pixi.Texture.from(canvas);
};

const createNoiseTexture = (
  pixi: typeof PIXI,
  size = 256,
  strength = 18
) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create noise context");
  }
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const value = clamp(
      24 + Math.random() * strength * 4,
      0,
      255
    );
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return pixi.Texture.from(canvas);
};

const createVignetteTexture = (pixi: typeof PIXI, size = 1024) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create vignette context");
  }
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.2,
    size / 2,
    size / 2,
    size * 0.5
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.65, "rgba(0,0,0,0.25)");
  gradient.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return pixi.Texture.from(canvas);
};

const createSheenTexture = (pixi: typeof PIXI, width = 512, height = 256) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create sheen context");
  }
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.06)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.18)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.06)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return pixi.Texture.from(canvas);
};

export async function createRichBlackBackground(
  options: RichBlackBackgroundOptions
): Promise<RichBlackBackgroundController> {
  const pixi = (await import("pixi.js")) as typeof PIXI;
  const BLEND_MODES = (pixi as unknown as {
    BLEND_MODES?: Record<string, number>;
  }).BLEND_MODES;
  const WRAP_MODES = (pixi as unknown as {
    WRAP_MODES?: Record<string, number>;
  }).WRAP_MODES;

  const app = new pixi.Application();
  await app.init({
    width: options.width,
    height: options.height,
    backgroundColor: 0x050608,
    antialias: true,
    resolution:
      options.resolution ??
      Math.min(1.4, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
    autoDensity: false,
    powerPreference: "low-power",
  });

  if (!app.canvas) {
    throw new Error("Pixi canvas unavailable");
  }

  app.canvas.style.position = "absolute";
  app.canvas.style.top = "0";
  app.canvas.style.left = "0";
  app.canvas.style.pointerEvents = "none";
  app.canvas.style.width = `${options.width}px`;
  app.canvas.style.height = `${options.height}px`;

  const root = new pixi.Container();
  root.eventMode = "none";
  app.stage.addChild(root);

  const gradient = new pixi.Sprite(createGradientTexture(pixi));
  gradient.anchor.set(0, 0);
  gradient.width = options.width;
  gradient.height = options.height;
  root.addChild(gradient);

  const vignette = new pixi.Sprite(createVignetteTexture(pixi));
  vignette.anchor.set(0.5);
  vignette.position.set(options.width / 2, options.height * 0.55);
  vignette.width = options.width * 1.45;
  vignette.height = options.height * 1.7;
  vignette.alpha = options.vignetteAlpha ?? 0.58;
  if (BLEND_MODES?.MULTIPLY !== undefined) {
    vignette.blendMode = BLEND_MODES.MULTIPLY as any;
  }
  root.addChild(vignette);

  const noiseTexture = createNoiseTexture(pixi);
  if (WRAP_MODES?.REPEAT !== undefined) {
    noiseTexture.baseTexture.wrapMode = WRAP_MODES.REPEAT as any;
  }
  const noise = new pixi.TilingSprite(
    noiseTexture,
    options.width,
    options.height
  );
  noise.alpha = options.noiseAlpha ?? 0.085;
  if (BLEND_MODES?.OVERLAY !== undefined) {
    noise.blendMode = BLEND_MODES.OVERLAY as any;
  }
  root.addChild(noise);

  const sheen = new pixi.Sprite(createSheenTexture(pixi));
  sheen.anchor.set(0.5);
  sheen.position.set(options.width / 2, options.height * 0.35);
  sheen.width = options.width * 1.2;
  sheen.height = Math.max(options.height * 0.45, 260);
  sheen.alpha = 0.12;
  if (BLEND_MODES?.SCREEN !== undefined) {
    sheen.blendMode = BLEND_MODES.SCREEN as any;
  }
  root.addChild(sheen);

  if (app.ticker) {
    app.ticker.stop();
    app.ticker.autoStart = false;
  }

  const animate = options.animate !== false && !!app.ticker;
  let tickHandle: ((ticker: PIXI.Ticker) => void) | null = null;

  if (animate && app.ticker) {
    let time = 0;
    tickHandle = (ticker: PIXI.Ticker) => {
      const delta = ticker.deltaTime;
      time += delta * 0.004;
      noise.tilePosition.x = Math.cos(time) * 12;
      noise.tilePosition.y = Math.sin(time * 0.7) * 8;
      sheen.rotation = Math.sin(time * 0.25) * 0.015;
      sheen.alpha = 0.1 + Math.sin(time * 0.35) * 0.015;
    };
    app.ticker.add(tickHandle);
    app.ticker.start();
  }

  const resize = (width: number, height: number) => {
    app.renderer.resize(width, height);
    gradient.width = width;
    gradient.height = height;
    vignette.position.set(width / 2, height * 0.55);
    vignette.width = width * 1.45;
    vignette.height = height * 1.7;
    noise.width = width;
    noise.height = height;
    sheen.position.set(width / 2, height * 0.35);
    sheen.width = width * 1.2;
    sheen.height = Math.max(height * 0.45, 260);
  };

  const destroy = () => {
    if (app.ticker && tickHandle) {
      app.ticker.remove(tickHandle);
    }
    try {
      app.destroy(true);
    } catch {
      // ignore
    }
  };

  return {
    canvas: app.canvas,
    resize,
    destroy,
  };
}
