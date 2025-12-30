/**
 * 🎮 Pure PixiJS版ガイドボタン
 *
 * ドラクエ風デザインのガイド表示をPixiJSで実装。
 * SpaceKeyHint / SubmitEHint の Pure PixiJS版。
 *
 * 機能:
 * - ドラクエ風黒背景 + 白枠デザイン
 * - GSAPアニメーション（パルス・フェードイン/アウト）
 * - レスポンシブ対応
 * - パーティクルエフェクト
 *
 * 使用例:
 * ```ts
 * const spaceGuide = new GuideButton({
 *   key: 'SPACE',
 *   description: 'で入力',
 *   keyColor: 0xFCDA6C, // ゴールド
 * });
 * spaceGuide.position.set(x, y);
 * app.stage.addChild(spaceGuide);
 * spaceGuide.show(); // 表示
 * spaceGuide.hide(); // 非表示
 * ```
 */

import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';

/**
 * ガイドボタン設定
 */
export interface GuideButtonConfig {
  /** 表示するキー名（例: "SPACE", "E"） */
  key: string;
  /** 説明文（例: "で入力", "/ ドラッグ"） */
  description: string;
  /** 矢印の向き（"up" | "down"） */
  arrowDirection?: 'up' | 'down';
  /** キーテキストの色（16進数） */
  keyColor?: number;
  /** 説明テキストの色（16進数） */
  descColor?: number;
  /** 背景色（16進数） */
  bgColor?: number;
  /** 枠線色（16進数） */
  borderColor?: number;
  /** パーティクル色（16進数） */
  particleColor?: number;
  /** パーティクル表示フラグ */
  showParticles?: boolean;
}

/**
 * ドラクエ風ガイドボタンクラス
 */
export class GuideButton extends PIXI.Container {
  private bg: PIXI.Graphics;
  private border: PIXI.Graphics;
  private keyText: PIXI.Text;
  private descText: PIXI.Text;
  private arrow: PIXI.Text;
  private particles: PIXI.Graphics[] = [];
  private particleContainer: PIXI.Container;
  private timeline: gsap.core.Timeline | null = null;

  // デフォルト設定（HD-2D / ドラクエ×オクトパストラベラー風）
  private static readonly DEFAULT_CONFIG = {
    arrowDirection: 'down' as const,
    keyColor: 0xfcda6c, // ゴールド
    descColor: 0xffffff, // 白
    bgColor: 0x08090f, // リッチブラック rgba(8,9,15)
    borderColor: 0xffffff, // 白
    particleColor: 0xfcda6c, // ゴールド
    showParticles: true,
  };

  // サイズ定数（HD-2D風コンパクトデザイン - オクトパストラベラー風に引き締め）
  private static readonly BOX_WIDTH = 140;
  private static readonly BOX_HEIGHT = 38;
  private static readonly BORDER_WIDTH = 2;
  private static readonly PADDING_X = 10;
  private static readonly PADDING_Y = 8;

  constructor(config: GuideButtonConfig) {
    super();

    // 設定マージ
    const finalConfig = { ...GuideButton.DEFAULT_CONFIG, ...config };

    // パーティクルコンテナ（矢印の先端位置に配置 - arrowDirection判定のため後で設定）
    this.particleContainer = new PIXI.Container();
    this.addChild(this.particleContainer);

    // 背景（シンプル＋ガイド感のあるデザイン）
    this.bg = new PIXI.Graphics();

    // メイン背景（リッチブラック）
    this.bg.clear();
    this.bg.rect(0, 0, GuideButton.BOX_WIDTH, GuideButton.BOX_HEIGHT);
    this.bg.fill({
      color: finalConfig.bgColor,
      alpha: 0.92,
    });

    this.addChild(this.bg);

    // 枠線（ガイド感のある白枠）
    this.border = new PIXI.Graphics();
    this.border.rect(
      GuideButton.BORDER_WIDTH / 2,
      GuideButton.BORDER_WIDTH / 2,
      GuideButton.BOX_WIDTH - GuideButton.BORDER_WIDTH,
      GuideButton.BOX_HEIGHT - GuideButton.BORDER_WIDTH
    );
    this.border.stroke({
      width: GuideButton.BORDER_WIDTH,
      color: finalConfig.borderColor,
      alpha: 0.9,
    });
    this.addChild(this.border);

    // テキストを一つのコンテナにまとめて完全センタリング
    const textContainer = new PIXI.Container();

    // キーテキスト（特別な色: ゴールド/ブルー）
    this.keyText = new PIXI.Text(`▶ ${config.key}`, {
      fontFamily: '"Courier New", monospace',
      fontSize: 14,
      fill: finalConfig.keyColor,
      fontWeight: '800',
      dropShadow: {
        alpha: 0.9,
        blur: 3,
        color: 0x000000,
        distance: 1.5,
        angle: Math.PI / 2,
      },
      letterSpacing: 0,
    });
    this.keyText.anchor.set(0, 0.5);
    this.keyText.x = 0;
    this.keyText.y = 0;
    textContainer.addChild(this.keyText);

    // 説明テキスト（白色）
    this.descText = new PIXI.Text(config.description, {
      fontFamily: '"Courier New", monospace',
      fontSize: 14,
      fill: 0xffffff,
      fontWeight: '700',
      dropShadow: {
        alpha: 0.9,
        blur: 3,
        color: 0x000000,
        distance: 1.5,
        angle: Math.PI / 2,
      },
      letterSpacing: 0,
    });
    this.descText.anchor.set(0, 0.5);
    this.descText.x = this.keyText.width + 4;
    this.descText.y = 0;
    textContainer.addChild(this.descText);

    // テキストコンテナ全体をボックスの中央に配置
    textContainer.x = GuideButton.BOX_WIDTH / 2 - (this.keyText.width + 4 + this.descText.width) / 2;
    textContainer.y = GuideButton.BOX_HEIGHT / 2;
    this.addChild(textContainer);

    // 矢印（向き設定可能: ↓ または ↑）
    const arrowChar = finalConfig.arrowDirection === 'up' ? '▲' : '▼';
    this.arrow = new PIXI.Text(arrowChar, {
      fontFamily: '"Courier New", monospace',
      fontSize: 20,
      fill: finalConfig.keyColor,
      fontWeight: '800',
      dropShadow: {
        alpha: 0.9,
        blur: 3,
        color: 0x000000,
        distance: 1.5,
        angle: Math.PI / 2,
      },
    });
    this.arrow.anchor.set(0.5, finalConfig.arrowDirection === 'up' ? 1 : 0);
    this.arrow.x = GuideButton.BOX_WIDTH / 2;
    this.arrow.y = finalConfig.arrowDirection === 'up' ? -6 : GuideButton.BOX_HEIGHT + 6;
    this.addChild(this.arrow);

    // パーティクルコンテナを矢印の先端位置に配置（矢印の外側に配置）
    const particleOffsetFromArrow = finalConfig.arrowDirection === 'up' ? -16 : 16;
    this.particleContainer.position.set(
      GuideButton.BOX_WIDTH / 2,
      finalConfig.arrowDirection === 'up' ? -6 + particleOffsetFromArrow : GuideButton.BOX_HEIGHT + 6 + particleOffsetFromArrow
    );

    // パーティクル生成（8個 - 8方向放射状の花火）
    if (finalConfig.showParticles) {
      // UI Core Spec: 可変の微差 - サイズに不均一性
      const particleSizes = [2.8, 3.2, 2.5, 3.5, 2.6, 3.3, 2.9, 3.1];
      for (let i = 0; i < 8; i++) {
        const particle = new PIXI.Graphics();
        particle.clear();
        particle.circle(0, 0, particleSizes[i]);
        particle.fill({ color: finalConfig.particleColor, alpha: 0.88 });
        particle.alpha = 0;
        this.particles.push(particle);
        this.particleContainer.addChild(particle);
      }
    }

    // 初期状態: 非表示
    this.alpha = 0;
    this.visible = false;
  }

  /**
   * ガイドボタンを表示（フェードイン + パルスアニメーション）
   */
  show(): void {
    this.visible = true;

    // 既存のタイムライン停止
    this.stopTimeline();

    // タイムライン作成
    this.timeline = gsap.timeline();

    // 矢印の向きに応じた初期Y位置
    const arrowDirection = this.arrow.text === '▲' ? 'up' : 'down';
    const arrowFinalY = arrowDirection === 'up' ? -6 : GuideButton.BOX_HEIGHT + 6;
    const arrowInitialY = arrowDirection === 'up' ? arrowFinalY - 10 : arrowFinalY + 10;

    // 初期状態リセット
    gsap.set(this, { alpha: 0, scale: 0.9 });
    gsap.set(this.arrow, { y: arrowInitialY, alpha: 0 });
    gsap.set(this.particles, { scale: 0, alpha: 1 });

    // 1. コンテナフェードイン（UI Core Spec: 出だし早く→着地やわらか）
    this.timeline.to(this, {
      alpha: 1,
      scale: 1,
      duration: 0.52,
      ease: 'cubic-bezier(.2,1,.3,1)', // 指示書推奨のカーブ
    });

    // 2. 矢印バウンス登場（小さなオーバーシュート）
    this.timeline.to(
      this.arrow,
      {
        y: arrowFinalY,
        alpha: 1,
        duration: 0.45,
        ease: 'cubic-bezier(.16,1.1,.3,1)', // 指示書推奨: 小さなオーバーシュート
      },
      '-=0.28'
    );

    // 3. パーティクル拡散（8方向放射状の花火 - UI Core Spec: 不等間隔）
    this.timeline.to(
      this.particles,
      {
        scale: 1.15,
        x: (i) => {
          // 8方向放射（角度: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°）
          const angle = (i * Math.PI * 2) / 8;
          // 距離に微差（10〜14px - UI Core Spec: 可変の微差）
          const distance = [12, 11, 13, 10.5, 12.5, 11.5, 13.5, 10][i] || 12;
          return Math.cos(angle) * distance;
        },
        y: (i) => {
          const angle = (i * Math.PI * 2) / 8;
          const distance = [12, 11, 13, 10.5, 12.5, 11.5, 13.5, 10][i] || 12;
          return Math.sin(angle) * distance;
        },
        alpha: 0,
        duration: 0.88,
        ease: 'cubic-bezier(.25,.85,.45,1)', // UI Core Spec: 出だし早く→着地やわらか
        stagger: {
          each: 0.045,
          from: 'random', // ランダム順で出現（UI Core Spec: 不等間隔）
        },
      },
      '-=0.35'
    );

    // 4. 矢印バウンスアニメーション（無限ループ、向きに応じて方向変更）
    const bounceAmount = arrowDirection === 'up' ? -8 : 8;
    this.timeline.to(
      this.arrow,
      {
        y: `+=${bounceAmount}`,
        duration: 0.42,
        repeat: -1,
        yoyo: true,
        ease: 'cubic-bezier(.4,.1,.6,.9)',
      },
      '-=0.5'
    );

    // 5. パルスアニメーション（無限ループ）
    this.timeline.to(
      this.bg,
      {
        alpha: 0.72,
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      },
      '-=1.0'
    );
  }

  /**
   * ガイドボタンを非表示（フェードアウト）
   */
  hide(): void {
    // 既存のタイムライン停止
    this.stopTimeline();

    // フェードアウト
    gsap.to(this, {
      alpha: 0,
      duration: 0.3,
      ease: 'power2.out',
      onComplete: () => {
        this.visible = false;
      },
    });
  }

  /**
   * 一時的に表示して自動で消える（アニメーション付き）
   * @param duration 表示時間（ミリ秒）
   */
  showTemporary(duration: number = 2500): void {
    this.visible = true;

    // 既存のタイムライン停止
    this.stopTimeline();

    // タイムライン作成
    this.timeline = gsap.timeline({
      onComplete: () => {
        this.visible = false;
      },
    });

    // 初期状態リセット
    gsap.set(this, { alpha: 0, scale: 0.9 });
    gsap.set(this.keyText, { y: this.keyText.y - 20 });
    gsap.set(this.descText, { y: this.descText.y - 20 });
    gsap.set(this.particles, { scale: 0, alpha: 1 });

    const keyInitialY = GuideButton.PADDING_Y;
    const descInitialY = GuideButton.PADDING_Y + 20;

    // 1. コンテナフェードイン
    this.timeline.to(this, {
      alpha: 1,
      scale: 1,
      duration: 0.55,
      ease: 'cubic-bezier(.2,1,.3,1.05)',
    });

    // 2. テキストスライドイン
    this.timeline.to(
      [this.keyText, this.descText],
      {
        y: (i) => [keyInitialY, descInitialY][i],
        duration: 0.48,
        ease: 'cubic-bezier(.18,.95,.28,1.08)',
      },
      '-=0.3'
    );

    // 3. パーティクル拡散（8方向放射状の花火 - UI Core Spec: 不等間隔）
    this.timeline.to(
      this.particles,
      {
        scale: 1.15,
        x: (i) => {
          // 8方向放射（角度: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°）
          const angle = (i * Math.PI * 2) / 8;
          // 距離に微差（10〜14px - UI Core Spec: 可変の微差）
          const distance = [12, 11, 13, 10.5, 12.5, 11.5, 13.5, 10][i] || 12;
          return Math.cos(angle) * distance;
        },
        y: (i) => {
          const angle = (i * Math.PI * 2) / 8;
          const distance = [12, 11, 13, 10.5, 12.5, 11.5, 13.5, 10][i] || 12;
          return Math.sin(angle) * distance;
        },
        alpha: 0,
        duration: 0.88,
        ease: 'cubic-bezier(.25,.85,.45,1)', // UI Core Spec: 出だし早く→着地やわらか
        stagger: {
          each: 0.045,
          from: 'random', // ランダム順で出現（UI Core Spec: 不等間隔）
        },
      },
      '-=0.55'
    );

    // 4. 指定時間待機
    this.timeline.to({}, { duration: duration / 1000 });

    // 5. フェードアウト
    this.timeline.to(this, {
      alpha: 0,
      duration: 0.52,
      ease: 'cubic-bezier(.4,.2,.6,1)',
    });
  }

  /**
   * タイムライン停止
   */
  private stopTimeline(): void {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
  }

  /**
   * クリーンアップ（メモリリーク防止）
   */
  destroy(options?: boolean | PIXI.DestroyOptions): void {
    if ((this as unknown as { destroyed?: boolean }).destroyed) {
      return;
    }
    this.stopTimeline();
    super.destroy(options);
  }
}

/**
 * プリセット: Spaceキーヒント（下向き矢印で連想ワード入力へ誘導）
 */
export function createSpaceGuide(): GuideButton {
  return new GuideButton({
    key: 'SPACE',
    description: 'で入力',
    arrowDirection: 'down',
    keyColor: 0xfcda6c, // ゴールド
    particleColor: 0xffa726, // 線香花火風オレンジ（矢印と差別化）
  });
}

/**
 * プリセット: Eキー/ドラッグヒント（上向き矢印でカード提出へ誘導）
 */
export function createSubmitEGuide(): GuideButton {
  return new GuideButton({
    key: 'E',
    description: '/ ドラッグ',
    arrowDirection: 'up',
    keyColor: 0x6cc6fc, // ブルー
    particleColor: 0xffa726, // 線香花火風オレンジ（矢印と差別化）
  });
}
