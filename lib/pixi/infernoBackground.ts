import type * as PIXI from "pixi.js";
import { safeDestroy } from "./safeDestroy";
import { loadPixi } from "./loadPixi";

const nextFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 16);
    }
  });

export interface InfernoBackgroundOptions {
  width: number;
  height: number;
  antialias?: boolean;
  resolution?: number;
}

export interface InfernoBackgroundController {
  canvas: HTMLCanvasElement;
  resize(width: number, height: number): void;
  destroy(): void;
  lightSweep(): void;
  launchFireworks(): void;
  launchVolcanoEruption(): void;
  launchMeteors(): void;
  flashRed?(count?: number, duration?: number): void;
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

type Meteor = {
  sprite: PIXI.Graphics;
  trail: PIXI.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  rotation: number;
  size: number;
};

// 🔥 煉獄の色パレット - 炎と溶岩
const INFERNO_PARTICLE_COLORS = [
  0xff4500, // オレンジレッド
  0xff6347, // トマト
  0xffa500, // オレンジ
  0xffff00, // 黄色
  0xff8c00, // ダークオレンジ
  0xdc143c, // クリムゾン
];

const INFERNO_EXPLOSION_COLORS = [
  0xff0000, // 赤
  0xff4500, // オレンジレッド
  0xff8c00, // ダークオレンジ
  0xffa500, // オレンジ
  0xffff00, // 黄色
  0xff6347, // トマト
];

const createInfernoParticles = (
  pixi: typeof PIXI,
  container: PIXI.Container,
  width: number,
  height: number,
  count: number
): Particle[] => {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i += 1) {
    const sprite = new pixi.Graphics();
    const radius = Math.random() * 2.5 + 1;
    sprite.circle(0, 0, radius);
    sprite.fill({
      color: INFERNO_PARTICLE_COLORS[Math.floor(Math.random() * INFERNO_PARTICLE_COLORS.length)],
      alpha: Math.random() * 0.7 + 0.3,
    });
    sprite.x = Math.random() * width;
    sprite.y = Math.random() * height;
    container.addChild(sprite);
    particles.push({
      sprite,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(Math.random() * 1.2 + 0.3), // 🔥 上昇する炎の粉
      life: Math.random() * 2 + 1,
    });
  }
  return particles;
};

export async function createInfernoBackground(
  options: InfernoBackgroundOptions
): Promise<InfernoBackgroundController> {
  const pixi = await loadPixi();
  const BLEND_MODES = (pixi as unknown as {
    BLEND_MODES?: Record<string, number>;
  }).BLEND_MODES;
  const app = new pixi.Application();
  await app.init({
    width: options.width,
    height: options.height,
    backgroundColor: 0x1a0000, // 深い赤黒
    antialias: options.antialias ?? true,
    resolution: options.resolution ?? 1,
    autoDensity: false,
  });

  await nextFrame();

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
  const meteorsContainer = new pixi.Container();

  sweepOverlay.alpha = 0;
  if (BLEND_MODES?.ADD !== undefined) {
    sweepOverlay.blendMode = BLEND_MODES.ADD as any;
  }

  stage.addChild(bgGradient);
  stage.addChild(mountains);
  stage.addChild(sweepOverlay);
  stage.addChild(particlesContainer);
  stage.addChild(meteorsContainer);
  stage.addChild(fireworksContainer);
  stage.addChild(foreground);

  if (app.ticker) {
    app.ticker.stop();
    app.ticker.autoStart = false;
  }

  const rebuildBackground = (width: number, height: number) => {
    // 🔥 煉獄の背景グラデーション（深紅〜オレンジ）
    bgGradient.clear();
    bgGradient.rect(0, 0, width, height);
    bgGradient.fill({
      color: 0x2a0000, // 深い赤黒
      alpha: 1,
    });

    // 🔥 険しい岩山のシルエット（ゴツゴツした形状）
    mountains.clear();
    mountains.moveTo(0, height * 0.65);
    const step = width < 800 ? 60 : 50; // より細かい間隔で険しさを表現
    for (let x = 0; x <= width; x += step) {
      // 複数のsin波を組み合わせて険しい山を作る
      const wave1 = Math.sin(x * 0.008) * 0.12;
      const wave2 = Math.sin(x * 0.025) * 0.08;
      const wave3 = Math.sin(x * 0.04) * 0.05;
      const pointY = height * (0.65 + wave1 + wave2 + wave3);
      mountains.lineTo(x, pointY);
    }
    mountains.lineTo(width, height);
    mountains.lineTo(0, height);
    mountains.fill({
      color: 0x0d0000, // ほぼ黒、わずかに赤み
      alpha: 0.95,
    });

    // 🔥 マグマの流れ（前景）
    foreground.clear();
    const lavaBaseY = height * 0.88;
    foreground.moveTo(0, lavaBaseY);
    for (let x = 0; x <= width; x += 25) {
      const wave = Math.sin(x * 0.01 + performance.now() * 0.001) * 8 + lavaBaseY;
      foreground.lineTo(x, wave);
    }
    foreground.lineTo(width, height);
    foreground.lineTo(0, height);
    foreground.fill({
      color: 0xff4500, // 溶岩オレンジ
      alpha: 0.7,
    });

    sweepOverlay.clear();
    sweepOverlay.beginFill(0xff0000, 0.5); // 🔥 強い赤いフラッシュ
    sweepOverlay.drawRect(0, 0, width, height);
    sweepOverlay.endFill();
    sweepOverlay.alpha = 0;
    mountains.position.set(0, 0);
    particlesContainer.position.set(0, 0);
    foreground.position.set(0, 0);
  };

  rebuildBackground(options.width, options.height);

  await nextFrame();

  // 🔥 溶岩の泡（前景に追加）
  for (let i = 0; i < 20; i += 1) {
    const bubble = new pixi.Graphics();
    const x = Math.random() * options.width;
    const y = options.height * (0.89 + Math.random() * 0.08);
    const size = Math.random() * 2 + 1;
    bubble.circle(x, y, size);
    bubble.fill({
      color: 0xff6347,
      alpha: 0.8,
    });
    foreground.addChild(bubble);
  }

  await nextFrame();

  // デバイス性能に応じてパーティクル数を調整
  const getParticleCount = (): number => {
    if (typeof navigator === "undefined") return 70;
    const cores = navigator.hardwareConcurrency || 4;
    if (cores <= 4) return 40;
    if (cores <= 8) return 55;
    return 70;
  };

  const particles = createInfernoParticles(
    pixi,
    particlesContainer,
    options.width,
    options.height,
    getParticleCount()
  );

  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerCurrentX = 0;
  let pointerCurrentY = 0;
  let sweepActive = false;
  let sweepStart = 0;
  let sweepFlashes = 0;
  let sweepFlashIndex = 0;
  const SWEEP_DURATION = 900;

  // 🔥 赤いフラッシュ（複数回点滅）
  const triggerLightSweep = () => {
    sweepActive = true;
    sweepStart = performance.now();
    sweepOverlay.alpha = 0;
    pointerTargetY = -0.35;
    sweepFlashes = 3; // 🔥 3回点滅
    sweepFlashIndex = 0;
  };

  // 🔥 カスタム赤フラッシュ（回数・時間指定可能）
  const triggerFlashRed = (count: number = 3, duration: number = 800) => {
    sweepActive = true;
    sweepStart = performance.now();
    sweepOverlay.alpha = 0;
    pointerTargetY = -0.35;
    sweepFlashes = count;
    sweepFlashIndex = 0;
  };

  const fireworks: Firework[] = [];
  const meteors: Meteor[] = [];

  // Object Pooling: Graphics オブジェクトの再利用
  const graphicsPool: PIXI.Graphics[] = [];
  const getGraphicsFromPool = (): PIXI.Graphics => {
    return graphicsPool.pop() || new pixi.Graphics();
  };
  const releaseGraphicsToPool = (graphics: PIXI.Graphics) => {
    graphics.clear();
    graphics.alpha = 1;
    graphics.visible = true;
    if (graphicsPool.length < 200) {
      graphicsPool.push(graphics);
    } else {
      safeDestroy(graphics, "inferno.graphicsPool");
    }
  };

  // 🔥 溶岩球を下から上へ噴き上げる（火山噴火）
  const launchLavaBall = (startX: number, startY: number, color: number) => {
    const lava = getGraphicsFromPool();
    lava.circle(0, 0, 7 + Math.random() * 4); // 大きめの溶岩塊
    lava.fill({ color, alpha: 1 });
    fireworksContainer.addChild(lava);

    fireworks.push({
      sprite: lava,
      x: startX,
      y: startY,
      vx: (Math.random() - 0.5) * 3,
      vy: -12 - Math.random() * 8, // 🔥 下から上へ強力に噴出
      life: 1,
      maxLife: 1,
      phase: "launch",
      exploded: false,
      color,
    });
  };

  // 🔥 溶岩球の爆発（全方向へ激しく飛び散る）
  const explodeLavaBall = (lava: Firework) => {
    lava.exploded = true;
    const particleCount = 100 + Math.floor(Math.random() * 50); // 🔥 より多くのパーティクル
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 4 + Math.random() * 4; // 🔥 より速く
      const particle = getGraphicsFromPool();
      particle.circle(0, 0, 2 + Math.random() * 2.5);
      particle.fill({ color: lava.color, alpha: 0.95 });
      fireworksContainer.addChild(particle);

      fireworks.push({
        sprite: particle,
        x: lava.x,
        y: lava.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        phase: "explode",
        exploded: true,
        color: lava.color,
      });
    }
  };

  const launchMeteor = (startX: number, startY: number, targetX: number, targetY: number, size: number) => {
    // 🔥 火山弾（燃える岩）
    const meteor = getGraphicsFromPool();
    meteor.circle(0, 0, size);
    meteor.fill({ color: 0x8b0000, alpha: 1 }); // 暗赤

    // 炎のトレイル
    const trail = getGraphicsFromPool();
    trail.rect(-size * 3, -size / 2, size * 3, size);
    trail.fill({ color: 0xff4500, alpha: 0.7 });

    meteorsContainer.addChild(trail);
    meteorsContainer.addChild(meteor);

    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = 20 + Math.random() * 10; // 🔥 より速く（20〜30）
    const vx = (dx / distance) * speed;
    const vy = (dy / distance) * speed;
    const rotation = Math.atan2(dy, dx);

    meteors.push({
      sprite: meteor,
      trail,
      x: startX,
      y: startY,
      vx,
      vy,
      life: 1,
      rotation,
      size,
    });
  };

  // 🔥 着弾爆発エフェクト
  const explodeMeteor = (meteor: Meteor) => {
    const particleCount = 30 + Math.floor(Math.random() * 20);
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 2 + Math.random() * 3;
      const particle = getGraphicsFromPool();
      particle.circle(0, 0, 1.5 + Math.random() * 2);
      particle.fill({ color: 0xff4500, alpha: 0.9 });
      fireworksContainer.addChild(particle);

      fireworks.push({
        sprite: particle,
        x: meteor.x,
        y: meteor.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6,
        maxLife: 0.6,
        phase: "explode",
        exploded: true,
        color: 0xff4500,
      });
    }
  };

  const triggerMeteors = () => {
    const width = app.screen.width;
    const height = app.screen.height;

    // 🔥 上から火山弾が降ってくる（6〜8個に増加）
    const meteorCount = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < meteorCount; i++) {
      setTimeout(() => {
        const startX = width * (0.2 + Math.random() * 0.6);
        const startY = -80 - Math.random() * 120;
        const targetX = width * (0.2 + Math.random() * 0.6);
        const targetY = height + 100 + Math.random() * 100;
        const size = 12 + Math.random() * 8; // 🔥 より大きく（12〜20）
        launchMeteor(startX, startY, targetX, targetY, size);
      }, i * 100 + Math.random() * 60); // より密集して降る
    }
  };

  // 🔥 火山噴火エフェクト（画面下部から溶岩噴出）
  const triggerVolcanoEruption = () => {
    const width = app.screen.width;
    const height = app.screen.height;

    // 🔥 複数箇所から溶岩噴出（下から上へ）- 画面全体に広がる
    const eruptions = 5; // 5箇所から噴出
    for (let i = 0; i < eruptions; i++) {
      setTimeout(() => {
        const x = width * (0.05 + Math.random() * 0.9); // 🔥 0.05〜0.95 でより広範囲
        const y = height; // 🔥 画面最下部から
        const color = INFERNO_EXPLOSION_COLORS[Math.floor(Math.random() * INFERNO_EXPLOSION_COLORS.length)];
        launchLavaBall(x, y, color);
      }, i * 80 + Math.random() * 50);
    }

    // 🔥 中央から大規模噴火
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const x = width * 0.5 + (Math.random() - 0.5) * width * 0.3; // 🔥 中央±15%→±15%でより広く
        const y = height;
        const color = INFERNO_EXPLOSION_COLORS[Math.floor(Math.random() * INFERNO_EXPLOSION_COLORS.length)];
        launchLavaBall(x, y, color);
      }, i * 120 + 300);
    }
  };

  let running = true;
  let frameId: number | null = null;
  let lastRender = performance.now();
  const minInterval = 1000 / 60;

  // Visibility API: 非アクティブ時は完全停止
  const handleVisibilityChange = () => {
    if (typeof document === "undefined") return;
    if (document.hidden) {
      running = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    } else {
      if (!running) {
        running = true;
        lastRender = performance.now();
        frameId = requestAnimationFrame(animate);
      }
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  const animate = (time: number) => {
    if (!running) {
      return;
    }
    frameId = requestAnimationFrame(animate);
    if (time - lastRender < minInterval) {
      return;
    }
    lastRender = time;

    // 🔥 炎の粉は上昇し、画面上部で消える
    particles.forEach((particle) => {
      const sprite = particle.sprite;
      if (!sprite) return;
      sprite.x += particle.vx;
      sprite.y += particle.vy;

      // 横方向は循環
      if (sprite.x > app.screen.width) sprite.x = 0;
      if (sprite.x < 0) sprite.x = app.screen.width;

      // 上部に達したら下からリスポーン
      if (sprite.y < -10) {
        sprite.y = app.screen.height + 10;
        sprite.x = Math.random() * app.screen.width;
      }

      sprite.alpha = Math.sin(time * 0.002 * particle.life) * 0.4 + 0.5;
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

    // 🔥 複数回点滅する赤フラッシュ
    if (sweepActive) {
      const elapsed = time - sweepStart;
      const flashInterval = 300; // 300ms間隔で点滅
      const flashDuration = 200; // 各フラッシュ200ms

      const currentFlash = Math.floor(elapsed / flashInterval);

      if (currentFlash < sweepFlashes) {
        const flashProgress = (elapsed % flashInterval) / flashDuration;
        if (flashProgress < 1) {
          // サイン波で急激に明るく→暗く
          sweepOverlay.alpha = Math.sin(Math.PI * flashProgress) * 0.6;
        } else {
          sweepOverlay.alpha = 0;
        }
      } else {
        sweepActive = false;
        sweepOverlay.alpha = 0;
        pointerTargetY = 0;
      }
    }

    // 火山弾アニメーション
    for (let i = meteors.length - 1; i >= 0; i--) {
      const meteor = meteors[i];
      if (!meteor.sprite || !meteor.trail) continue;

      meteor.x += meteor.vx;
      meteor.y += meteor.vy;
      meteor.life -= 0.007;

      meteor.sprite.x = meteor.x;
      meteor.sprite.y = meteor.y;
      meteor.sprite.rotation = meteor.rotation;
      meteor.sprite.alpha = Math.max(0, meteor.life);

      meteor.trail.x = meteor.x;
      meteor.trail.y = meteor.y;
      meteor.trail.rotation = meteor.rotation;
      meteor.trail.alpha = Math.max(0, meteor.life * 0.7);

      // 🔥 画面下部90%で着弾爆発
      if (meteor.y > height * 0.9 && meteor.life > 0.5) {
        explodeMeteor(meteor);
        meteor.life = 0; // 即座に消去
      }

      if (meteor.y > height + 200 || meteor.life <= 0) {
        meteorsContainer.removeChild(meteor.sprite);
        meteorsContainer.removeChild(meteor.trail);
        releaseGraphicsToPool(meteor.sprite);
        releaseGraphicsToPool(meteor.trail);
        meteors.splice(i, 1);
      }
    }

    // 爆炎アニメーション
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const fw = fireworks[i];
      if (!fw.sprite) {
        fireworks.splice(i, 1);
        continue;
      }

      if (fw.phase === "launch") {
        fw.x += fw.vx;
        fw.y += fw.vy;
        fw.vy += 0.18; // 重力
        fw.life -= 0.015;

        fw.sprite.x = fw.x;
        fw.sprite.y = fw.y;

        if ((fw.vy >= -0.5 || fw.life <= 0.3) && !fw.exploded) {
          explodeLavaBall(fw);
          fireworksContainer.removeChild(fw.sprite);
          releaseGraphicsToPool(fw.sprite);
          fireworks.splice(i, 1);
          continue;
        }
      } else if (fw.phase === "explode") {
        fw.x += fw.vx;
        fw.y += fw.vy;
        fw.vy += 0.1; // 重力
        fw.vx *= 0.97; // 空気抵抗
        fw.life -= 0.012;

        fw.sprite.x = fw.x;
        fw.sprite.y = fw.y;
        fw.sprite.alpha = Math.max(0, fw.life);

        if (fw.life <= 0) {
          fireworksContainer.removeChild(fw.sprite);
          releaseGraphicsToPool(fw.sprite);
          fireworks.splice(i, 1);
        }
      }
    }

    app.renderer.render(stage);
  };

  frameId = requestAnimationFrame(animate);

  const controller: InfernoBackgroundController = {
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
      triggerVolcanoEruption();
    },
    launchVolcanoEruption() {
      triggerVolcanoEruption();
    },
    launchMeteors() {
      triggerMeteors();
    },
    flashRed(count?: number, duration?: number) {
      triggerFlashRed(count, duration);
    },
    destroy() {
      running = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      particles.forEach((particle, index) => {
        safeDestroy(particle.sprite, `inferno.destroy.particle#${index}`);
      });
      fireworks.forEach((fw, index) => {
        safeDestroy(fw.sprite, `inferno.destroy.firework#${index}`);
      });
      fireworks.length = 0;
      meteors.forEach((meteor, index) => {
        safeDestroy(meteor.sprite, `inferno.destroy.meteor#${index}`);
        safeDestroy(meteor.trail, `inferno.destroy.meteorTrail#${index}`);
      });
      meteors.length = 0;
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
