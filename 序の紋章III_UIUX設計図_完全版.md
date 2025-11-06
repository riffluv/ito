# 「序の紋章 III」専用 UI/UXデザイン指示書：設計図

## エグゼクティブサマリー：決定的な1点突破戦略

調査の結果、個人開発の限界を超えるための**決定的な1点**を特定しました：

**「オンライン酒場の温度感」= リアルタイム同期演出における人間的な"間"と"揺らぎ"の設計**

この1点に全リソースを集中することで、AAA級の体験を部分的に実現し、他の協力推理ゲームとの決定的な差別化を図ります。

---

## I. プロジェクト固有の核心原則

### 1.1 このゲームの本質的価値

**「オンライン上の酒場」というメタファーの具現化**

調査から明らかになった3つの決定的要素：

1. **温度感（Warmth）**
   - ドラクエ風UIの「優しさ」「非否定性」
   - HD-2Dの「手触り感」「ノスタルジア」
   - パーティクル・照明による「光の温もり」

2. **間（Ma）と揺らぎ（Fluctuation）**
   - 完全同期（0ms）vs 段階的表示（50-100ms）の使い分け
   - 人間的な「溜め」（200-300ms）で期待感を醸成
   - 意図的な非対称性で機械感を排除

3. **一体感（Togetherness）**
   - カード公開の「せーの」感覚
   - 成功時の共同祝福演出
   - 失敗時の「またやろう」という前向き誘導

### 1.2 守るべき2つの核

**核1：「AI感」の完全排除**
- 100ms以内の応答（必須）
- ease-out系イージング（linear禁止）
- 音+視覚+物理の三位一体フィードバック

**核2：「また遊びたい」の設計**
- 5-15分の短時間セッション
- 失敗を責めない言葉遣い
- 次のゲームへの自然な誘導

---

## II. 段階的実装ロードマップ

### Phase 0: MVP期（Week 1-2）- 最小限の魔法

**実装優先度P0（これがないと始まらない）：**

1. **音響フィードバックシステム**
   - カーソル移動：「ピッ」（50ms）
   - 決定：「ピロリン」（100ms、ease-out）
   - カード公開：「シャッ」（タイミング完全同期）
   - 成功/失敗：対照的な音響設計
   
   **実装指示：**
   ```javascript
   // CLAUDE.mdに記載すべき仕様
   const SOUND_TIMINGS = {
     cursorMove: { delay: 0, duration: 50 },
     decide: { delay: 0, duration: 100, ease: 'power1.out' },
     cardReveal: { delay: 0, duration: 400, ease: 'back.out(1.7)' }
   };
   ```

2. **カード公開の基本演出**
   - 3D回転：600ms、back.out(1.7)
   - 付随要素：
     - translateZ(100px)で中間点の深み
     - パーティクル5-10個（放射状）
     - 音響の完全同期（0ms遅延）
   
   **タブー：**
   - ❌ linear easing
   - ❌ 音なし回転
   - ❌ 単調な一定速度

3. **リアルタイム同期の基盤**
   - WebSocket + サーバータイムスタンプ
   - RTT測定と補正（NTPライク）
   - クライアント予測 + サーバー検証

### Phase 1: 洗練期（Week 3-6）- 温度感の注入

**実装優先度P1（体験を決定づける）：**

1. **感情曲線の設計**
   
   **カード配布シーケンス：**
   ```javascript
   gsap.timeline()
     .to(cards, {
       autoAlpha: 1,
       stagger: {
         each: 0.08,      // 80ms間隔＝リズム感
         from: 'center',   // 公平感
         ease: 'power2.out'
       },
       duration: 0.3
     });
   ```

2. **成功演出（1500ms）**
   ```
   0ms:    即座のフィードバック（音+色変化）
   200ms:  溜め（scale: 0.95）
   400ms:  爆発（scale: 1.3, elastic.out）
   1000ms: パーティクル最大値
   1500ms: 余韻（フェードアウト）
   ```

3. **失敗演出（800ms）**
   ```
   0ms:    認識（音+x軸振動）
   300ms:  理解（テキスト表示「またチャレンジしよう！」）
   800ms:  次への準備完了
   ```

4. **HD-2D風質感**
   - ピクセルパーフェクト：image-rendering: pixelated
   - メッセージウィンドウ：8pxグリッド、角丸8px
   - 文字送り：50ms/文字（3段階調整可能）
   - 色温度：#1E3A8A（温かい青）+ #FCD34D（金アクセント）

### Phase 2: 運用期（Month 2+）- 包摂性の実装

**実装優先度P2（幅広い受容）：**

1. **prefers-reduced-motion対応**
   ```css
   @media (prefers-reduced-motion: reduce) {
     .card-flip {
       animation-duration: 0.3s; /* 0.6sから短縮 */
       /* scale削除、opacity変化のみ */
     }
   }
   ```

2. **色覚多様性対応**
   - 色+形状+テキストの三重エンコーディング
   - 成功：緑+✓+「成功」
   - 失敗：赤+✗+「失敗」
   - コントラスト比4.5:1以上

3. **カスタマイズオプション**
   - アニメーション速度：3段階
   - 文字速度：3段階
   - UIスケール：80-120%
   - 音量：個別調整

---

## III. Claude Code向け実装指示の最適構造

### 3.1 CLAUDE.mdファイルの設計

```markdown
# 序の紋章 III - Claude Implementation Guide

## Core Philosophy
このゲームは「オンライン上の酒場」です。
すべてのUIは「温かさ」「一体感」「また遊びたい」を優先します。

## Absolute Rules（絶対ルール）
<rules>
  <must>
    - 応答時間100ms以内
    - linear easing禁止（ease-outファミリー使用）
    - 音+視覚+物理の三位一体フィードバック
  </must>
  <never>
    - ユーザーを責める表現
    - スキップ不可能な長時間アニメーション
    - 色のみに依存した情報表示
  </never>
</rules>

## Timing Standards
<timings>
  <instant>0-100ms: ボタン、カーソル</instant>
  <quick>100-200ms: 軽いUI遷移</quick>
  <anticipation>200-300ms: 演出的「溜め」</anticipation>
  <dramatic>400-800ms: カード公開、重要演出</dramatic>
</timings>

## Easing Guide
<easings>
  <default>power2.out</default>
  <playful>back.out(1.7)</playful>
  <celebratory>elastic.out(1, 0.3)</celebratory>
  <forbidden>linear</forbidden>
</easings>

## Real-time Sync Strategy
- Perfect sync (0ms): ゲーム開始、カード配布開始
- Staggered (50-100ms): カード公開、順次演出
- Theatrical (300ms+): 成功/失敗の「溜め」

## HD-2D Visual Tokens
<design-tokens>
  <colors>
    <primary>#1E3A8A</primary>
    <accent>#FCD34D</accent>
    <background>#0F172A</background>
    <text>#FEFEFE</text>
  </colors>
  <spacing>
    <base>8px</base>
    <multiplier>8, 16, 24, 32</multiplier>
  </spacing>
</design-tokens>
```

### 3.2 実装チェックリストの自己検証設計

**Before Implementation（実装前）：**
- [ ] この機能は「酒場の温かさ」に貢献するか？
- [ ] 応答時間100ms以内を保証できるか？
- [ ] アクセシビリティを考慮したか？

**During Implementation（実装中）：**
- [ ] イージング関数は適切か？（linearでないか？）
- [ ] 音声フィードバックを追加したか？
- [ ] エッジケース（ネットワーク切断等）を考慮したか？

**After Implementation（実装後）：**
- [ ] prefers-reduced-motionで動作確認したか？
- [ ] 色覚シミュレーションツールでチェックしたか？
- [ ] 3人以上でリアルタイムテストしたか？

### 3.3 Good/Bad例の粒度設計

**Level 1: マイクロインタラクション**

❌ **Bad - 機械的な反応：**
```javascript
button.addEventListener('click', () => {
  button.classList.add('clicked');
});
```
理由：視覚変化のみ、音なし、物理感なし

✅ **Good - 三位一体フィードバック：**
```javascript
button.addEventListener('click', () => {
  // 視覚
  gsap.to(button, { scale: 0.95, duration: 0.1 })
    .then(() => gsap.to(button, { scale: 1, duration: 0.2, ease: 'back.out(1.7)' }));
  
  // 聴覚
  playSound('decide', { delay: 0 });
  
  // 物理（オプション：モバイル）
  if (navigator.vibrate) navigator.vibrate(50);
});
```

**Level 2: カード公開演出**

❌ **Bad - AI感満載：**
```javascript
gsap.to(card, {
  rotationY: 180,
  duration: 0.5,
  ease: 'linear'  // ❌
});
```
問題：linearで機械的、音なし、深み表現なし

✅ **Good - 温かみのある公開：**
```javascript
const tl = gsap.timeline();

// 溜め
tl.to(card, { scale: 0.95, duration: 0.15 })
  
// 公開（3段階で深みを表現）
  .to(card, {
    rotationY: -90,
    translateZ: 100,  // 手前に浮き出る
    duration: 0.3,
    ease: 'power2.in'
  })
  .call(() => playSound('cardFlip'))  // 音を同期
  .to(card, {
    rotationY: -180,
    translateZ: 0,
    duration: 0.3,
    ease: 'back.out(1.7)'
  })
  
// パーティクル
  .call(() => createSparkles(card));
```

**Level 3: リアルタイム同期**

❌ **Bad - クライアント信頼型：**
```javascript
socket.emit('cardRevealed', { cardId, playerId });
// 即座にUI更新（他プレイヤーとずれる）
revealCard(cardId);
```

✅ **Good - サーバー権威型：**
```javascript
// クライアント予測
socket.emit('revealCard', { cardId, timestamp: Date.now() });
optimisticallyReveal(cardId);  // ローカル表示

// サーバー検証
socket.on('cardRevealed', ({ cardId, serverTimestamp, allPlayers }) => {
  const latency = Date.now() - serverTimestamp;
  
  // ズレを補正
  if (latency > 100) {
    reconcileState(cardId);
  }
  
  // 全員の状態を同期
  syncAllPlayers(allPlayers);
});
```

---

## IV. 「崩し」の哲学と判断基準

### 4.1 Chakra UI v3制約下での意図的逸脱

**守るべき場面（80%）：**
- 情報表示、フォーム、ナビゲーション
- 標準的なUI要素
- アクセシビリティが重要な箇所

**超えるべき場面（20%）：**
- カード公開演出（ゲームの核）
- 成功/失敗フィードバック
- リアルタイム同期表示
- HD-2D風の質感表現

**判断フローチャート：**
```
デザイントークンから逸脱したい？
↓
理由は「酒場の温かさ」の向上か？
  No → トークンに従う
  Yes ↓
代替案（トークン内）を検討したか？
  No → 検討する
  Yes ↓
アクセシビリティへの影響は？
  悪影響 → 代替手段を用意
  問題なし ↓
→ 逸脱を許可（文書化）
```

### 4.2 variants / layerStyles / sx の使い分け

**variants（推奨度：高）：**
- 再利用可能なパターン
- ボタン、カード、メッセージウィンドウ
- チーム全体で共有

**layerStyles（推奨度：中）：**
- 視覚的スタイルの組み合わせ
- HD-2D風の質感レイヤー
- グラデーション、影、枠線

**sx（推奨度：低、慎重に）：**
- 一時的な調整
- プロトタイピング
- 後でvariantsに昇格させる

---

## V. アクセシビリティと演出の共存戦略

### 5.1 削ぎ落としても残る「体験の核」

**フル体験（no-preference）：**
- カード3D回転 + パーティクル + 音
- スケーリング + 深み表現
- 600-800msの演出

**軽減体験（reduced-motion）：**
- カードフェードイン + 音
- スケーリングなし
- 300msの演出

**最小体験（厳格設定）：**
- 即座の状態変化 + 音
- 色変化のみ
- 100msの演出

**重要原則：**
- 音響フィードバックは全レベルで保持
- 色+形状+テキストの三重エンコーディング
- 情報伝達の核は削らない

### 5.2 HD-2D質感とコントラストの両立

**レイヤー分離アプローチ：**
```
Layer 1（背景）: HD-2D質感、低コントラスト可
Layer 2（情報）: 高コントラスト（4.5:1以上）必須
Layer 3（装飾）: オプショナル、削除可能
```

**実装例：**
```css
.message-window {
  /* Layer 1: 質感 */
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
  
  /* Layer 2: 情報 */
  color: #FEFEFE;
  text-shadow: 2px 2px 0 #000;  /* コントラスト確保 */
  
  /* Layer 3: 装飾 */
  box-shadow: 
    0 0 0 2px #1e3a8a,
    4px 4px 8px rgba(0, 0, 0, 0.5),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3);
}

/* 高コントラストモード */
@media (prefers-contrast: high) {
  .message-window {
    background: #000;  /* Layer 1を単色化 */
    border: 4px solid #FFF;  /* Layer 2を強調 */
    box-shadow: none;  /* Layer 3を削除 */
  }
}
```

---

## VI. プロが絶対にやらない「タブー」集

### 6.1 このプロジェクト固有のタブー

**情報設計のタブー：**
- ❌ プレイヤーを責める表現
  - 「エラー：無効な操作」
  - ✅ 「もう一度試してみよう」
  
- ❌ 曖昧なフィードバック
  - 「処理中…」（いつ終わる？）
  - ✅ 「カードを配っています…3/4」

**演出設計のタブー：**
- ❌ スキップ不可能な長時間演出
  - 初回は良いが2回目以降は苦痛
  - ✅ すべての演出にスキップオプション
  
- ❌ 過剰な同時アニメーション
  - 画面全体が動くと何に注目すべきか不明
  - ✅ 1つの主役、2-3の脇役

**操作設計のタブー：**
- ❌ ダブルクリック必須の重要操作
  - シングルタップ文化の無視
  - ✅ シングルクリック + 確認ダイアログ
  
- ❌ ホバーのみの情報表示
  - タッチデバイスで見えない
  - ✅ タップでも表示

### 6.2 技術的負債を生むパターン

**避けるべきコードパターン：**

❌ **Bad - ハードコード地獄：**
```javascript
gsap.to(card, { x: 320, y: 240, duration: 0.5 });
```

✅ **Good - トークン駆動：**
```javascript
gsap.to(card, { 
  x: LAYOUT.centerX, 
  y: LAYOUT.centerY, 
  duration: TIMINGS.cardMove 
});
```

❌ **Bad - 音声の直接再生：**
```javascript
new Audio('click.mp3').play();
```

✅ **Good - サウンドマネージャー：**
```javascript
SoundManager.play('decide', { 
  volume: userSettings.sfxVolume,
  delay: 0
});
```

---

## VII. 個人開発での「1点突破」実行プラン

### 7.1 リソース配分（100時間想定）

**Phase 0（30時間）：基盤**
- 音響システム：10時間
- カード公開演出：15時間
- リアルタイム同期基盤：5時間

**Phase 1（40時間）：温度感注入**
- 感情曲線設計：15時間
- HD-2D質感：10時間
- 文字送りシステム：10時間
- プレイテスト：5時間

**Phase 2（30時間）：包摂性**
- reduced-motion対応：10時間
- 色覚対応：10時間
- カスタマイズUI：10時間

### 7.2 技術的時短テクニック

**活用すべきツール：**
1. **GSAP + Draggable Plugin**（購入推奨）
   - 物理感のあるドラッグ実装が10分で完成
   - InertiaPlugin で投げる動作
   
2. **Pixi.js ParticleContainer**
   - 1000個のパーティクルを60fps
   - GPU最適化済み

3. **Howler.js**（音響管理）
   - クロスブラウザ対応
   - スプライト対応

4. **SNES.css**（HD-2D基盤）
   - レトロUIの基礎実装済み
   - カスタマイズ可能

**アウトソーシング候補：**
- 効果音：Epidemic Sound、Artlist
- HD-2Dアセット：itch.io、OpenGameArt
- プレイテスト：Discord コミュニティ

### 7.3 成功の測定指標

**定量的指標：**
- 応答時間：平均50ms以下（目標）
- フレームレート：安定60fps
- セッション時間：平均10分
- リプレイ率：70%以上

**定性的指標：**
- プレイテストで「温かい」という言葉が出る
- 「もう1回」と自然に言われる
- 失敗時に笑顔が見られる
- 操作を褒められる（「気持ちいい」）

---

## VIII. 実装の優先順位マトリクス

### 8.1 必須 vs 推奨 vs 理想

**必須（MVP期）：**
1. 音響フィードバック三位一体
2. カード公開演出の基本
3. リアルタイム同期の基盤
4. 非否定的エラーメッセージ
5. 基本的なHD-2D質感

**推奨（洗練期）：**
6. 感情曲線の完全設計
7. reduced-motion対応
8. 文字送りシステム
9. カスタマイズオプション
10. 色覚多様性対応

**理想（運用期）：**
11. パーティクルの豊富化
12. 触覚フィードバック（モバイル）
13. 複数の視覚テーマ
14. 完全なアクセシビリティ
15. 観戦モード

### 8.2 依存関係チェーン

```
音響システム（Day 1-2）
  ↓
カード公開演出（Day 3-5）
  ↓ 依存
リアルタイム同期（Day 6-8）
  ↓ 並行可能
HD-2D質感（Day 9-12）
感情曲線設計（Day 9-12）
  ↓
アクセシビリティ（Day 13-16）
  ↓
カスタマイズUI（Day 17-20）
```

---

## IX. 指示書の読まれ方の最適化

### 9.1 3段階アクセス設計

**Level 1：クイックリファレンス（CLAUDE.md）**
- 200-300行
- 核心原則のみ
- 常に参照

**Level 2：実装ガイド（docs/guides/）**
- 500-1000行/ファイル
- 具体的パターン
- 必要時参照

**Level 3：完全仕様（docs/reference/）**
- 制限なし
- 全エッジケース
- 稀に参照

### 9.2 段階的な情報開示

**Week 1：**「なぜ」を理解
- プロジェクトの哲学
- 核心原則
- 基本パターン

**Week 2-4：**「どうやって」を学ぶ
- 具体的実装
- Good/Bad例
- トラブルシューティング

**Month 2+：**「なぜそうなったか」を深掘り
- 設計判断の背景
- トレードオフの理由
- 将来の拡張性

---

## X. まとめ：実装開始のチェックリスト

### 10.1 今すぐ始める3ステップ

**Step 1：CLAUDE.mdファイル作成（30分）**
```markdown
# 序の紋章 III - Core Principles

## What is this game?
オンライン上の酒場での協力推理ゲーム

## Non-negotiables
- 応答100ms以内
- linear easing禁止
- ユーザーを責めない

## Timing Standards
[上記のタイミング表を転記]

## Good/Bad Examples
[3-5個の具体例]
```

**Step 2：サウンドシステム実装（4時間）**
- Howler.js導入
- 5種類の効果音準備
- SoundManager クラス作成

**Step 3：カード公開演出プロトタイプ（8時間）**
- GSAP導入
- 3D transform実装
- 音響との同期確認

### 10.2 1週間後の目標

- [ ] 基本的な音響フィードバック動作
- [ ] カード公開演出が「気持ちいい」
- [ ] 3人同時接続で同期確認
- [ ] プレイテスター1名から「温かい」フィードバック

### 10.3 1ヶ月後の目標

- [ ] 感情曲線が完全動作
- [ ] HD-2D質感が実装済み
- [ ] reduced-motion対応完了
- [ ] 10人以上のプレイテスト完了
- [ ] 「また遊びたい」率70%達成

---

## XI. 調査の核心的発見

### 11.1 「AI感」を生む原因トップ5

1. **100ms以上の遅延**（最悪）
2. **linear easing**（機械的）
3. **音響フィードバックの欠如**（冷たい）
4. **物理シミュレーションなし**（軽い）
5. **単一モーダルフィードバック**（貧弱）

### 11.2 「温かい」と感じさせる要素トップ5

1. **非否定的な言葉遣い**（最重要）
2. **適切な「間」（200-300ms）**（人間的）
3. **音+視覚+物理の統合**（豊か）
4. **エラー時の優しい誘導**（安心）
5. **HD-2Dの質感**（ノスタルジア）

### 11.3 プロの暗黙知トップ5

1. **削除の判断**（何を見せないか）
2. **レスポンス100ms以内**（体感速度）
3. **一貫性とバリエーション**（予測可能だが退屈でない）
4. **エッジケースへの配慮**（丁寧さ）
5. **1点への集中**（完璧より完成）

---

## XII. 参考文献とツール

### 主要参考文献
- Game Accessibility Guidelines
- The Last of Us Part II アクセシビリティ
- ペルソナ5 UIデザイン哲学
- オクトパストラベラー HD-2D技術
- GSAP公式ドキュメント
- Claude Code Best Practices

### 推奨ツール
- GSAP 3 + Plugins（購入推奨）
- Pixi.js 8
- Howler.js
- SNES.css
- Color Oracle（色覚シミュレーション）
- Chroma by Ubisoft（リアルタイムシミュレーション）

---

## 最後に：個人開発者へのメッセージ

この指示書は、7つの専門領域からの深い調査に基づいています。すべてを実装する必要はありません。

**重要なのは1点：**

「オンライン酒場の温度感」を実現するために、
- カード公開演出に全力を注ぎ
- 音響フィードバックを完璧にし
- リアルタイム同期の「間」を設計する

この3つがあれば、他の協力推理ゲームとの決定的な差別化が可能です。

AAA級の「全部」は不可能ですが、
AAA級の「1点」は個人開発でも達成できます。

その1点が、あなたのゲームの「魂」になります。

---

**調査完了日**: 2025年11月6日  
**調査範囲**: UI心理学、HD-2D技術、商業ゲーム事例、アニメーション技術、アクセシビリティ、プロの暗黙知、Claude向け指示書設計  
**総参照資料**: 150+件  

このドキュメントは、実装者（Claude Code）が「意図を理解」して実装するための包括的な知識ベースとして設計されています。