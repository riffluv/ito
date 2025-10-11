import type * as PIXI from "pixi.js";

export interface DragonQuestBackgroundOptions {
  width: number;
  height: number;
  antialias?: boolean;
  resolution?: number;
}

export interface DragonQuestBackgroundController {
  canvas: HTMLCanvasElement;
  resize(width: number, height: number): void;
  destroy(): void;
}

type Particle = {
  sprite: PIXI.Graphics;
  vx: number;
  vy: number;
  life: number;
};

const SAFE_COLORS = [
  0xffd700,
  0xffdc00,
  0xffc700,
  0xffed4a,
  0xfff176,
  0xffb300,
];

const createParticles = (
  pixi: typeof PIXI,
  container: PIXI.Container,
  width: number,
  height: number,
  count: number
): Particle[] => {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i += 1) {
    const sprite = new pixi.Graphics();
    const radius = Math.random() * 2 + 1;
    sprite.circle(0, 0, radius);
    sprite.fill({
      color: SAFE_COLORS[Math.floor(Math.random() * SAFE_COLORS.length)],
      alpha: Math.random() * 0.6 + 0.2,
    });
    sprite.x = Math.random() * width;
    sprite.y = Math.random() * height;
    container.addChild(sprite);
    particles.push({
      sprite,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.3,
      life: Math.random() * 2 + 1,
    });
  }
  return particles;
};

export async function createDragonQuestBackground(
  options: DragonQuestBackgroundOptions
): Promise<DragonQuestBackgroundController> {
  const pixi = (await import("pixi.js")) as typeof PIXI;
  const app = new pixi.Application();
  await app.init({
    width: options.width,
    height: options.height,
    backgroundColor: 0x0e0f13,
    antialias: options.antialias ?? true,
    resolution: options.resolution ?? 1,
    autoDensity: false,
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

  const stage = app.stage;
  const bgGradient = new pixi.Graphics();
  const mountains = new pixi.Graphics();
  const foreground = new pixi.Graphics();
  const particlesContainer = new pixi.Container();

  stage.addChild(bgGradient);
  stage.addChild(mountains);
  stage.addChild(particlesContainer);
  stage.addChild(foreground);

  if (app.ticker) {
    app.ticker.stop();
    app.ticker.autoStart = false;
  }

  const rebuildBackground = (width: number, height: number) => {
    bgGradient.clear();
    bgGradient.rect(0, 0, width, height);
    bgGradient.fill({
      color: 0x1a1b2e,
      alpha: 1,
    });

    mountains.clear();
    mountains.moveTo(0, height * 0.7);
    for (let x = 0; x <= width; x += 100) {
      const pointY = height * (0.7 + Math.sin(x * 0.01) * 0.15);
      mountains.lineTo(x, pointY);
    }
    mountains.lineTo(width, height);
    mountains.lineTo(0, height);
    mountains.fill({
      color: 0x2d1b4e,
      alpha: 0.8,
    });

    foreground.clear();
    const grassBaseY = height * 0.87;
    foreground.moveTo(0, grassBaseY);
    for (let x = 0; x <= width; x += 30) {
      const wave = Math.sin(x * 0.008) * 12 + grassBaseY;
      foreground.lineTo(x, wave);
    }
    foreground.lineTo(width, height);
    foreground.lineTo(0, height);
    foreground.fill({
      color: 0x2d5940,
      alpha: 0.8,
    });
  };

  rebuildBackground(options.width, options.height);

  for (let i = 0; i < 15; i += 1) {
    const accent = new pixi.Graphics();
    const x = Math.random() * options.width;
    const y = options.height * (0.88 + Math.random() * 0.08);
    const size = Math.random() * 1.5 + 0.8;
    accent.circle(x, y, size);
    accent.fill({
      color: 0x4a7c59,
      alpha: 0.7,
    });
    foreground.addChild(accent);
  }

  const particles = createParticles(
    pixi,
    particlesContainer,
    options.width,
    options.height,
    60
  );

  let running = true;
  let frameId: number | null = null;
  let lastRender = performance.now();
  const minInterval = 1000 / 60;

  const animate = (time: number) => {
    if (!running) {
      return;
    }
    frameId = requestAnimationFrame(animate);
    if (time - lastRender < minInterval) {
      return;
    }
    lastRender = time;

    particles.forEach((particle) => {
      const sprite = particle.sprite;
      if (!sprite) return;
      sprite.x += particle.vx;
      sprite.y += particle.vy;
      if (sprite.x > app.screen.width) sprite.x = 0;
      if (sprite.x < 0) sprite.x = app.screen.width;
      if (sprite.y > app.screen.height) sprite.y = 0;
      if (sprite.y < 0) sprite.y = app.screen.height;
      sprite.alpha =
        Math.sin(time * 0.001 * particle.life) * 0.3 + 0.4;
    });

    app.renderer.render(stage);
  };

  frameId = requestAnimationFrame(animate);

  const controller: DragonQuestBackgroundController = {
    canvas: app.canvas,
    resize(width: number, height: number) {
      app.renderer.resize(width, height);
      app.canvas.style.width = `${width}px`;
      app.canvas.style.height = `${height}px`;
      rebuildBackground(width, height);
    },
    destroy() {
      running = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      particles.forEach((particle) => {
        particle.sprite.destroy();
      });
      try {
        stage.removeChildren();
        app.destroy(true);
      } catch {
        // noop
      }
    },
  };

  return controller;
}

