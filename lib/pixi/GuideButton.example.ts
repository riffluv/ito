/**
 * 🎮 GuideButton 使用例
 *
 * Pure PixiJS版ガイドボタンの実装サンプル。
 * GameScene等で実際に使う際の参考コード。
 */

import * as PIXI from 'pixi.js';
import { GuideButton, createSpaceGuide, createSubmitEGuide } from './GuideButton';

/**
 * 基本的な使い方
 */
export function basicUsageExample(app: PIXI.Application) {
  // プリセットを使った作成
  const spaceGuide = createSpaceGuide();
  spaceGuide.position.set(window.innerWidth / 2 - 90, window.innerHeight - 150);
  app.stage.addChild(spaceGuide);

  // 表示
  spaceGuide.show();

  // 非表示
  setTimeout(() => {
    spaceGuide.hide();
  }, 3000);
}

/**
 * カスタムカラーでの作成
 */
export function customColorExample(app: PIXI.Application) {
  const customGuide = new GuideButton({
    key: 'TAB',
    description: 'で切替',
    keyColor: 0xff6b6b, // 赤
    descColor: 0xffffff,
    particleColor: 0xff6b6b,
  });

  customGuide.position.set(100, 100);
  app.stage.addChild(customGuide);
  customGuide.show();
}

/**
 * 一時的に表示（自動で消える）
 */
export function temporaryShowExample(app: PIXI.Application) {
  const tempGuide = createSpaceGuide();
  tempGuide.position.set(window.innerWidth / 2 - 90, window.innerHeight - 150);
  app.stage.addChild(tempGuide);

  // 2.5秒間だけ表示
  tempGuide.showTemporary(2500);
}

/**
 * ゲームフェーズに応じた表示切り替え
 */
export function gamePhaseExample(app: PIXI.Application) {
  // Spaceガイド（左下）
  const spaceGuide = createSpaceGuide();
  spaceGuide.position.set(window.innerWidth / 2 - 90, window.innerHeight - 150);
  app.stage.addChild(spaceGuide);

  // Eガイド（右下）
  const eGuide = createSubmitEGuide();
  eGuide.position.set(window.innerWidth / 2 + 90, window.innerHeight - 150);
  app.stage.addChild(eGuide);

  // ゲームフェーズ管理
  const showGuideForPhase = (phase: string) => {
    switch (phase) {
      case 'associating':
        // 連想ワード入力フェーズ
        spaceGuide.show();
        eGuide.hide();
        break;

      case 'submitting':
        // カード提出フェーズ
        spaceGuide.hide();
        eGuide.show();
        break;

      default:
        // その他
        spaceGuide.hide();
        eGuide.hide();
        break;
    }
  };

  // 使用例
  showGuideForPhase('associating'); // Spaceガイド表示
  setTimeout(() => showGuideForPhase('submitting'), 5000); // 5秒後にEガイド表示
}

/**
 * レスポンシブ対応の配置例
 */
export function responsivePositionExample(app: PIXI.Application) {
  const spaceGuide = createSpaceGuide();
  const eGuide = createSubmitEGuide();

  // リサイズ処理
  const updatePositions = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // モバイル vs デスクトップで配置変更
    if (width < 768) {
      // モバイル: 中央下部
      spaceGuide.position.set(width / 2 - 90, height - 100);
      eGuide.position.set(width / 2 - 90, height - 180);
    } else {
      // デスクトップ: 左右配置
      spaceGuide.position.set(width / 2 - 180, height - 150);
      eGuide.position.set(width / 2 + 90, height - 150);
    }
  };

  // 初期配置
  updatePositions();
  app.stage.addChild(spaceGuide);
  app.stage.addChild(eGuide);

  // リサイズイベント
  window.addEventListener('resize', updatePositions);

  spaceGuide.show();
  eGuide.show();
}

/**
 * パーティクル無しバージョン
 */
export function noParticleExample(app: PIXI.Application) {
  const simpleGuide = new GuideButton({
    key: 'ESC',
    description: 'で戻る',
    keyColor: 0xffffff,
    showParticles: false, // パーティクル無効化
  });

  simpleGuide.position.set(100, 100);
  app.stage.addChild(simpleGuide);
  simpleGuide.show();
}

/**
 * 複数のガイドを同時管理
 */
export class GuideManager {
  private guides: Map<string, GuideButton> = new Map();
  private container: PIXI.Container;

  constructor(stage: PIXI.Container) {
    this.container = new PIXI.Container();
    stage.addChild(this.container);
  }

  /**
   * ガイド追加
   */
  addGuide(id: string, guide: GuideButton, x: number, y: number): void {
    guide.position.set(x, y);
    this.container.addChild(guide);
    this.guides.set(id, guide);
  }

  /**
   * ガイド表示
   */
  showGuide(id: string): void {
    const guide = this.guides.get(id);
    if (guide) {
      guide.show();
    }
  }

  /**
   * ガイド非表示
   */
  hideGuide(id: string): void {
    const guide = this.guides.get(id);
    if (guide) {
      guide.hide();
    }
  }

  /**
   * 全ガイド非表示
   */
  hideAll(): void {
    this.guides.forEach((guide) => guide.hide());
  }

  /**
   * ガイド削除
   */
  removeGuide(id: string): void {
    const guide = this.guides.get(id);
    if (guide) {
      guide.destroy();
      this.guides.delete(id);
    }
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    this.guides.forEach((guide) => guide.destroy());
    this.guides.clear();
    this.container.destroy();
  }
}

/**
 * GuideManager使用例
 */
export function guideManagerExample(app: PIXI.Application) {
  const manager = new GuideManager(app.stage);

  // ガイド追加
  manager.addGuide('space', createSpaceGuide(), window.innerWidth / 2 - 90, window.innerHeight - 150);
  manager.addGuide('e', createSubmitEGuide(), window.innerWidth / 2 + 90, window.innerHeight - 150);

  // フェーズごとに表示切り替え
  manager.showGuide('space');

  setTimeout(() => {
    manager.hideGuide('space');
    manager.showGuide('e');
  }, 3000);

  // 全非表示
  setTimeout(() => {
    manager.hideAll();
  }, 6000);
}
