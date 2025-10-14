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
  lightSweep(): void;
  launchFireworks(): void;
}

type Particle = {
  sprite: PIXI.Graphics;
  vx: number;
  vy: number;
  life: number;
};

type Firework = {
  sprite: PIXI.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  phase: "launch" | "explode";
  exploded: boolean;
  color: number;
};

const SAFE_COLORS = [
  0xffd700,
  0xffdc00,
  0xffc700,
  0xffed4a,
  0xfff176,
  0xffb300,
];

const FIREWORK_COLORS = [
  0xff3366, // ピンク
  0xffaa00, // オレンジ
  0xffff33, // 黄色
  0x33ff66, // 緑
  0x33aaff, // 青
  0xaa33ff, // 紫
  0xff66ff, // マゼンタ
  0xffffff, // 白
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
  const BLEND_MODES = (pixi as unknown as {
    BLEND_MODES?: Record<string, number>;
  }).BLEND_MODES;
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
  const sweepOverlay = new pixi.Graphics();
  const foreground = new pixi.Graphics();
  const particlesContainer = new pixi.Container();
  const fireworksContainer = new pixi.Container();

  sweepOverlay.alpha = 0;
  if (BLEND_MODES?.ADD !== undefined) {
    sweepOverlay.blendMode = BLEND_MODES.ADD as any;
  }

  stage.addChild(bgGradient);
  stage.addChild(mountains);
  stage.addChild(sweepOverlay);
  stage.addChild(particlesContainer);
  stage.addChild(fireworksContainer);
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
    sweepOverlay.clear();
    sweepOverlay.beginFill(0xffffff, 0.25);
    sweepOverlay.drawRect(0, 0, width, height);
    sweepOverlay.endFill();
    sweepOverlay.alpha = 0;
    mountains.position.set(0, 0);
    particlesContainer.position.set(0, 0);
    foreground.position.set(0, 0);
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

  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerCurrentX = 0;
  let pointerCurrentY = 0;
  let sweepActive = false;
  let sweepStart = 0;
  const SWEEP_DURATION = 900;

  const triggerLightSweep = () => {
    sweepActive = true;
    sweepStart = performance.now();
    sweepOverlay.alpha = 0;
    pointerTargetY = -0.35;
  };

  const fireworks: Firework[] = [];

  const launchFirework = (startX: number, startY: number, color: number) => {
    console.log('🚀 launchFirework:', { startX, startY, color, containerChildren: fireworksContainer.children.length });
    const fw = new pixi.Graphics();
    fw.circle(0, 0, 4);
    fw.fill({ color, alpha: 1 });
    fireworksContainer.addChild(fw);

    fireworks.push({
      sprite: fw,
      x: startX,
      y: startY,
      vx: (Math.random() - 0.5) * 2,
      vy: -8 - Math.random() * 4,
      life: 1,
      maxLife: 1,
      phase: "launch",
      exploded: false,
      color,
    });
    console.log('🚀 Firework added! Total:', fireworks.length);
  };

  const explodeFirework = (fw: Firework) => {
    fw.exploded = true;
    const particleCount = 60 + Math.floor(Math.random() * 40);
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 3 + Math.random() * 4;
      const particle = new pixi.Graphics();
      particle.circle(0, 0, 2 + Math.random() * 2);
      particle.fill({ color: fw.color, alpha: 0.9 });
      fireworksContainer.addChild(particle);

      fireworks.push({
        sprite: particle,
        x: fw.x,
        y: fw.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        phase: "explode",
        exploded: true,
        color: fw.color,
      });
    }
  };

  const triggerFireworks = () => {
    console.log('🎆 triggerFireworks called!', { width: app.screen.width, height: app.screen.height, fireworksCount: fireworks.length });
    const width = app.screen.width;
    const height = app.screen.height;

    // 左の山から3発
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const x = width * 0.15 + Math.random() * width * 0.1;
        const y = height * 0.75;
        const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
        console.log(`🎆 Launching firework ${i} from LEFT:`, { x, y, color });
        launchFirework(x, y, color);
      }, i * 120);
    }

    // 右の山から3発
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const x = width * 0.75 + Math.random() * width * 0.1;
        const y = height * 0.75;
        const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
        launchFirework(x, y, color);
      }, i * 120 + 60);
    }

    // 中央から2発（でっかい！）
    for (let i = 0; i < 2; i++) {
      setTimeout(() => {
        const x = width * 0.45 + Math.random() * width * 0.1;
        const y = height * 0.8;
        const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
        launchFirework(x, y, color);
      }, i * 180 + 240);
    }
  };



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

    pointerCurrentX += (pointerTargetX - pointerCurrentX) * 0.06;
    pointerCurrentY += (pointerTargetY - pointerCurrentY) * 0.06;
    const width = app.screen.width;
    const height = app.screen.height;
    mountains.x = pointerCurrentX * width * 0.05;
    mountains.y = pointerCurrentY * height * 0.04;
    particlesContainer.x = pointerCurrentX * width * 0.025;
    particlesContainer.y = pointerCurrentY * height * 0.03;
    foreground.x = pointerCurrentX * width * 0.07;
    foreground.y = pointerCurrentY * height * 0.06;

    if (sweepActive) {
      const elapsed = time - sweepStart;
      const t = Math.min(1, elapsed / SWEEP_DURATION);
      const envelope = Math.sin(Math.PI * t);
      sweepOverlay.alpha = envelope * 0.35;
      if (elapsed >= SWEEP_DURATION) {
        sweepActive = false;
        sweepOverlay.alpha = 0;
        pointerTargetY = 0;
      }
    }

    // 花火アニメーション
    if (fireworks.length > 0 && Math.random() < 0.1) {
      console.log('🎆 Animating fireworks:', fireworks.length);
    }
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const fw = fireworks[i];
      if (!fw.sprite) continue;

      if (fw.phase === "launch") {
        fw.x += fw.vx;
        fw.y += fw.vy;
        fw.vy += 0.15; // 重力
        fw.life -= 0.016;

        fw.sprite.x = fw.x;
        fw.sprite.y = fw.y;

        // 頂点に達したら爆発
        if (fw.vy > 0 && !fw.exploded) {
          explodeFirework(fw);
          fw.sprite.destroy();
          fireworks.splice(i, 1);
          continue;
        }
      } else if (fw.phase === "explode") {
        fw.x += fw.vx;
        fw.y += fw.vy;
        fw.vy += 0.08; // 重力
        fw.vx *= 0.98; // 空気抵抗
        fw.life -= 0.013;

        fw.sprite.x = fw.x;
        fw.sprite.y = fw.y;
        fw.sprite.alpha = Math.max(0, fw.life);
      }

      // ライフが尽きたら削除
      if (fw.life <= 0) {
        fw.sprite.destroy();
        fireworks.splice(i, 1);
      }
    }

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
    lightSweep() {
      triggerLightSweep();
    },
    launchFireworks() {
      triggerFireworks();
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
      fireworks.forEach((fw) => {
        fw.sprite.destroy();
      });
      fireworks.length = 0;
      if (typeof window !== "undefined") {
        // no pointer listeners to remove currently
      }
      sweepActive = false;
      sweepOverlay.alpha = 0;
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
