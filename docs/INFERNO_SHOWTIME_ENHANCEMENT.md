# 煉獄背景 Showtime 演出強化 指示書

## 📋 概要

煉獄バージョンの背景における showtime 演出を、より派手で地獄感あふれるものに強化する。
夜版はそのまま維持し、煉獄のみを変更する。

---

## 🎯 対象ファイル

- `lib/pixi/infernoBackground.ts`
- `lib/showtime/actions.ts`（必要に応じて）

---

## 🔥 強化方針

### 1. 花火 → 噴火エフェクトに変更

**現状:**
- `launchFireworks()` が虹色の花火を発射
- 夜版と同じパターン

**変更後:**
- **火山噴火**のイメージに変更
- 画面下部から溶岩が噴き上がる
- 赤〜オレンジの大きな火柱
- 爆発的な広がり

**実装イメージ:**
```typescript
const triggerVolcanoEruption = () => {
  // 画面下部の複数箇所から溶岩噴出
  const eruptions = 5; // 3〜5箇所

  for (let i = 0; i < eruptions; i++) {
    // 下から上へ噴き上がる
    const x = width * (0.1 + Math.random() * 0.8);
    const y = height; // 画面最下部から

    // 溶岩の塊を上方向に発射
    launchLavaBall(x, y, color);
  }
};
```

**色:**
- `0xFF0000` (赤)
- `0xFF4500` (オレンジレッド)
- `0xFF8C00` (ダークオレンジ)
- `0xFFA500` (オレンジ)

**パーティクル数:**
- 爆発時: 100〜150個（花火より多く）
- 速度: より速く（speed: 4〜8）
- 範囲: 広く爆発（全方向）

---

### 2. フラッシュエフェクトの強化

**現状:**
- `lightSweep()` が白い光のフラッシュ
- alpha: 0.35

**変更後:**
- **赤いフラッシュ**に変更（地獄感）
- より強く、より長く
- 複数回点滅

**実装詳細:**

#### A. 色の変更
```typescript
// sweepOverlay の色を変更
sweepOverlay.clear();
sweepOverlay.beginFill(0xFF0000, 0.5); // 🔥 赤く強いフラッシュ
sweepOverlay.drawRect(0, 0, width, height);
sweepOverlay.endFill();
```

#### B. アニメーションの強化
```typescript
const triggerLightSweep = () => {
  sweepActive = true;
  sweepStart = performance.now();
  sweepOverlay.alpha = 0;
  pointerTargetY = -0.35;

  // 🔥 複数回点滅パターン
  sweepFlashes = 3; // 3回点滅
  sweepFlashIndex = 0;
};

// アニメーションループ内
if (sweepActive) {
  const elapsed = time - sweepStart;
  const flashInterval = 300; // 300ms間隔で点滅
  const flashDuration = 200; // 各フラッシュの長さ

  const currentFlash = Math.floor(elapsed / flashInterval);

  if (currentFlash < sweepFlashes) {
    const flashProgress = (elapsed % flashInterval) / flashDuration;
    if (flashProgress < 1) {
      // サイン波で点滅（急激に明るく→暗く）
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
```

---

### 3. 火山弾（Meteors）の強化

**現状:**
- 上から下に落ちる

**変更後:**
- より多く（6〜8個）
- より大きく（size: 12〜20）
- より速く（speed: 20〜30）
- 着弾時に爆発エフェクト追加

**着弾爆発:**
```typescript
// 隕石が画面下部に到達したら爆発
if (meteor.y > height * 0.9) {
  explodeMeteor(meteor); // 小規模な爆発パーティクル
}
```

---

## 🎬 Showtime アクションとの連携

`lib/showtime/scenarios/` 内で煉獄専用のシナリオを作成可能：

```typescript
// lib/showtime/scenarios/infernoRoundReveal.ts
export const infernoRoundRevealScenario: Scenario = [
  {
    action: "background.volcanoEruption", // 🔥 新規アクション
    params: { intensity: "high" },
  },
  {
    action: "background.flashRed", // 🔥 赤フラッシュ
    params: { count: 3, duration: 800 },
  },
  {
    action: "audio.play",
    params: { id: "inferno_eruption" }, // 噴火SE
    fireAndForget: true,
  },
];
```

`lib/showtime/actions.ts` に追加:
```typescript
const backgroundVolcanoEruption: ActionExecutor = async (params) => {
  if (!ensureClient()) return;
  try {
    window.bg?.launchVolcanoEruption?.();
  } catch (error) {
    logWarn(SCOPE, "bg.launchVolcanoEruption failed", error);
  }
};

const backgroundFlashRed: ActionExecutor = async (params) => {
  if (!ensureClient()) return;
  try {
    window.bg?.flashRed?.(params?.count || 3, params?.duration || 800);
  } catch (error) {
    logWarn(SCOPE, "bg.flashRed failed", error);
  }
};
```

---

## 📊 パフォーマンス考慮

### 重さの比較

| 項目 | 現在（花火） | 強化後（噴火） | 影響 |
|------|------------|--------------|------|
| パーティクル数 | 80〜130個 | 100〜150個 | +20% |
| フラッシュ回数 | 1回 | 3回 | +200% |
| 火山弾数 | 4〜6個 | 6〜8個 | +30% |

**対策:**
- ローエンドデバイスでは自動的にパーティクル数削減（既存の `getParticleCount` が機能）
- フラッシュは軽量（alpha変更のみ）
- Object Pooling で再利用

**結論: 許容範囲内**

---

## 🎨 デザイン指針

### 地獄感の演出

1. **色:** 赤・オレンジ・黄色（炎の色）
2. **動き:** 下から上へ噴き上がる（重力に逆らう）
3. **速度:** 速く激しく
4. **範囲:** 広く爆発的
5. **光:** 強く点滅、画面全体を照らす

### 夜版との差別化

| 要素 | 夜版 | 煉獄版 |
|------|------|--------|
| 特殊効果 | 花火（上品） | 噴火（激烈） |
| フラッシュ色 | 白 | 赤 |
| 方向 | 上→下（花火） | 下→上（噴火） |
| 雰囲気 | 静寂・幻想的 | 激動・破壊的 |

---

## ✅ 実装チェックリスト

### Phase 1: 基本実装
- [ ] `triggerVolcanoEruption()` 関数を実装
- [ ] 溶岩噴出のビジュアル調整
- [ ] 赤フラッシュの実装
- [ ] 複数回点滅の実装

### Phase 2: 強化
- [ ] 火山弾の数・サイズ・速度を増加
- [ ] 着弾爆発エフェクト追加
- [ ] パーティクル数を増加

### Phase 3: 統合
- [ ] `window.bg` インターフェースに追加
- [ ] showtime アクションに統合（オプション）
- [ ] パフォーマンステスト

### Phase 4: 調整
- [ ] 色の微調整
- [ ] タイミングの調整
- [ ] ローエンドデバイスでの動作確認

---

## 🎯 期待される効果

1. **煉獄らしさの向上**
   - 花火 → 噴火で地獄感アップ
   - 赤フラッシュで恐怖感演出

2. **showtime の派手さ**
   - 複数回の点滅で視覚的インパクト
   - より多くのパーティクルで迫力

3. **夜版との明確な差別化**
   - 上品な夜 vs 激烈な煉獄
   - ユーザーが選ぶ楽しみ

---

## 📝 実装ノート

### 既存コードの参照箇所

- `lib/pixi/infernoBackground.ts:382-413` - `triggerFireworks()`
- `lib/pixi/infernoBackground.ts:256-261` - `triggerLightSweep()`
- `lib/pixi/infernoBackground.ts:479-489` - sweep アニメーション

### 変更時の注意点

1. **cleanup を忘れずに**
   - 新しいパーティクルも `destroy()` で破棄
   - メモリリーク対策

2. **Object Pooling を活用**
   - `getGraphicsFromPool()` / `releaseGraphicsToPool()`

3. **Visibility API**
   - タブ非表示時は停止（既存実装を維持）

4. **型安全性**
   - `window.bg` インターフェースを更新
   - TypeScript エラーが出ないように

---

## 🚀 次のステップ

1. この指示書を Codex (GPT-5 Coding Agent) に渡す
2. `lib/pixi/infernoBackground.ts` を修正してもらう
3. ブラウザでテスト
4. 必要に応じて微調整

---

**最終更新:** 2025-10-28
**作成者:** Claude (Design Review)
**対象:** Codex (Coding Agent)
