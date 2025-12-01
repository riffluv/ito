/**
 * Battle Records アンビエント効果
 *
 * 戦績表の背景に追加する大気効果:
 * - 勝利時: 金色の微粒子が上昇 + 淡いグロー脈動
 * - 敗北時: 青白い微粒子が下降 + 静かな脈動
 *
 * 万能デザイン指示書の原則:
 * - 粒子サイズ・速度に微差（不均一）
 * - タイミングに不等間隔
 * - 控えめな主張
 */

import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';

export interface AmbientParticlesOptions {
  /** コンテナの幅 */
  width: number;
  /** コンテナの高さ */
  height: number;
  /** 勝利/敗北フラグ（false=勝利、true=敗北） */
  failed?: boolean;
}

/**
 * アンビエントパーティクルシステム
 */
export class BattleRecordsAmbient extends PIXI.Container {
  private particles: PIXI.Graphics[] = [];
  private glowLayer: PIXI.Graphics;
  private options: AmbientParticlesOptions;
  private animationsStarted = false;

  // 勝利時のカラー（ゴールド系）
  private static readonly VICTORY_COLORS = [
    0xffd700, // ゴールド
    0xffa500, // オレンジゴールド
    0xffed4e, // ライトゴールド
  ];

  // 敗北時のカラー（ブルー系）
  private static readonly DEFEAT_COLORS = [
    0x6cc6fc, // ライトブルー
    0x4a9eff, // ブルー
    0x82d4ff, // ペールブルー
  ];

  constructor(options: AmbientParticlesOptions) {
    super();
    this.options = options;

    // グローレイヤー（背景全体に淡い光）
    this.glowLayer = new PIXI.Graphics();
    this.glowLayer.zIndex = -5;
    this.addChild(this.glowLayer);

    // パーティクル生成（24個 - 万能指示書: 微差のある数）
    this.createParticles(24);
  }

  /**
   * ウォームアップ完了後に明示的に呼び出してアニメーションを開始する
   * （初回アクセス時にGPU初期化が間に合わない問題の回避策）
   */
  public initialize(): void {
    this.startAnimations();
  }

  /**
   * パーティクル生成
   */
  private createParticles(count: number): void {
    const { width, height, failed } = this.options;
    const colors = failed
      ? BattleRecordsAmbient.DEFEAT_COLORS
      : BattleRecordsAmbient.VICTORY_COLORS;

    for (let i = 0; i < count; i++) {
      const particle = new PIXI.Graphics();

      // 微差のあるサイズ（万能指示書: 可変の微差）
      const sizeVariants = [1.5, 2, 2.5, 3, 3.5];
      const size = sizeVariants[i % sizeVariants.length];

      // ランダムな色
      const color = colors[Math.floor(Math.random() * colors.length)];

      // 微差のあるアルファ
      const alphaVariants = [0.3, 0.4, 0.5, 0.6];
      const alpha = alphaVariants[i % alphaVariants.length];

      particle.clear();
      particle.circle(0, 0, size);
      particle.fill({ color, alpha });

      // ランダムな初期位置
      particle.x = Math.random() * width;
      particle.y = Math.random() * height;

      // Z-index で奥行き感（ランダム）
      particle.zIndex = -4 + Math.random() * 2;

      this.particles.push(particle);
      this.addChild(particle);
    }
  }

  /**
   * アニメーション開始
   */
  private startAnimations(): void {
    if (this.animationsStarted) return;
    this.animationsStarted = true;
    const { height, failed } = this.options;

    // パーティクルアニメーション
    this.particles.forEach((particle, index) => {
      // 微差のある速度（万能指示書: 不均一）
      const durationVariants = [8, 10, 12, 14, 16];
      const duration = durationVariants[index % durationVariants.length];

      // 初期位置をランダムに配置（固まりを防ぐ）
      const randomStartOffset = Math.random() * height;

      if (failed) {
        // 敗北時: 下降（沈む感じ）
        const startY = -20;
        const endY = height + 20;
        const totalDistance = endY - startY;

        // 初期位置をランダムに
        particle.y = startY + randomStartOffset;

        // 無限ループアニメーション（モジュロ演算で滑らかにループ）
        gsap.to(particle, {
          y: `+=${totalDistance}`,
          duration,
          ease: 'linear',
          repeat: -1,
          modifiers: {
            y: (y: string) => {
              const currentY = parseFloat(y);
              // 画面外に出たら上に戻す（シームレス）
              if (currentY > height + 20) {
                return String(currentY - totalDistance);
              }
              return y;
            },
          },
        });
      } else {
        // 勝利時: 上昇（舞い上がる感じ）
        const startY = height + 20;
        const endY = -20;
        const totalDistance = startY - endY;

        // 初期位置をランダムに
        particle.y = startY - randomStartOffset;

        // 無限ループアニメーション（モジュロ演算で滑らかにループ）
        gsap.to(particle, {
          y: `-=${totalDistance}`,
          duration,
          ease: 'linear',
          repeat: -1,
          modifiers: {
            y: (y: string) => {
              const currentY = parseFloat(y);
              // 画面外に出たら下に戻す（シームレス）
              if (currentY < -20) {
                return String(currentY + totalDistance);
              }
              return y;
            },
          },
        });
      }

      // 横方向の微妙な揺れ（不等間隔）
      gsap.to(particle, {
        x: `+=${Math.random() * 30 - 15}`,
        duration: duration / 3,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      // アルファの微妙な変化
      gsap.to(particle, {
        alpha: `+=${Math.random() * 0.2 - 0.1}`,
        duration: duration / 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });

    // グローレイヤーの脈動
    this.drawGlow();
    gsap.to(this.glowLayer, {
      alpha: failed ? 0.08 : 0.12, // 敗北時は控えめ
      duration: failed ? 3.5 : 2.8, // 敗北時はゆっくり
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }

  /**
   * グローレイヤーの描画
   */
  private drawGlow(): void {
    const { width, height, failed } = this.options;

    this.glowLayer.clear();

    // 勝利時: ゴールドグロー
    // 敗北時: ブルーグロー
    const glowColor = failed ? 0x4a9eff : 0xffd700;

    // 中央から外側へのグラデーション風（複数の円で表現）
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.max(width, height) * 0.8;

    for (let i = 0; i < 3; i++) {
      const radius = maxRadius * (0.3 + i * 0.3);
      const alpha = failed ? 0.03 : 0.05;

      this.glowLayer.circle(centerX, centerY, radius);
      this.glowLayer.fill({ color: glowColor, alpha });
    }

    this.glowLayer.alpha = failed ? 0.05 : 0.08;
  }

  /**
   * リサイズ対応
   */
  resize(width: number, height: number): void {
    this.options.width = width;
    this.options.height = height;
    this.drawGlow();
  }

  /**
   * クリーンアップ
   */
  destroy(options?: boolean | PIXI.DestroyOptions): void {
    // すべてのGSAPアニメーションを停止
    gsap.killTweensOf(this.particles);
    gsap.killTweensOf(this.glowLayer);
    this.animationsStarted = false;

    super.destroy(options);
  }
}
