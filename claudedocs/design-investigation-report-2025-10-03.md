# デザイン調査レポート

**調査日**: 2025-10-03
**プロジェクト**: 序の紋章III (Online ITO - ドラクエ風数字カードゲーム)
**目的**: AI感が残っている箇所や改善可能なデザイン要素の洗い出し

---

## 📊 調査統計

- **調査ファイル数**: 100+ TSX/TSファイル
- **AI感検出箇所**: 28箇所
- **パフォーマンス問題**: 3箇所
- **UX改善候補**: 7箇所
- **良好なコンポーネント**: 多数（後述）

---

## 🚨 AI感が残っている箇所

### 1. **DragonQuestLoading.tsx** (C:/Users/hr-hm/Desktop/codex/components/ui/DragonQuestLoading.tsx)

**問題**: duration値が定型的（0.2, 0.3など0.1刻み）
**該当箇所**:
- Line 78: `duration: 0.2` → フェードイン
- Line 98: `duration: 0.35` → プログレスバー
- Line 220: `duration: 0.3` → フェードアウト

**現在の値**:
```typescript
duration: 0.2   // Line 78
duration: 0.35  // Line 98
duration: 0.3   // Line 220
```

**推奨値**:
```typescript
duration: 0.23  // Line 78 - 微妙に不規則に
duration: 0.38  // Line 98 - 0.35より少し長く
duration: 0.27  // Line 220 - 0.3より少し短く
```

**優先度**: 中


### 2. **DragonQuestNotify.tsx** (C:/Users/hr-hm/Desktop/codex/components/ui/DragonQuestNotify.tsx)

**問題**: duration値が0.5, 0.18など定型的
**該当箇所**:
- Line 155: `duration: 0.5`
- Line 161: `duration: 0.18`
- Line 195: `duration: 0.35`

**現在の値**:
```typescript
duration: 0.5   // エントランス
duration: 0.18  // コンテンツフェード
duration: 0.35  // エグジット
```

**推奨値**:
```typescript
duration: 0.46  // より自然に
duration: 0.21  // 0.18より微増
duration: 0.37  // 0.35より微増
```

**優先度**: 中


### 3. **PhaseAnnouncement.tsx** (C:/Users/hr-hm/Desktop/codex/components/ui/PhaseAnnouncement.tsx)

**問題**: 完璧な角度 (360度, 180度) と定型duration
**該当箇所**:
- Line 76: `rotation: 360` - 完璧な1回転
- Line 99: `rotation: "-=180"` - 完璧な半回転
- Line 129: `rotation: "+=360"` - 完璧な1回転
- Line 92: `duration: 0.2`
- Line 101: `duration: 0.2`
- Line 109: `duration: 0.1`
- Line 122: `duration: 0.3`

**現在の値**:
```typescript
rotation: 360       // Line 76
rotation: "-=180"   // Line 99
rotation: "+=360"   // Line 129
duration: 0.2       // Line 92
duration: 0.1       // Line 109
duration: 0.3       // Line 122
```

**推奨値**:
```typescript
rotation: 354       // 360° → 354° (微妙に不完全)
rotation: "-=173"   // 180° → 173° (微妙にずらす)
rotation: "+=357"   // 360° → 357° (微妙にずらす)
duration: 0.19      // 0.2 → 0.19
duration: 0.11      // 0.1 → 0.11
duration: 0.28      // 0.3 → 0.28
```

**優先度**: 高（アイコン回転が目立つUI要素）


### 4. **GameResultOverlay.tsx** (C:/Users/hr-hm/Desktop/codex/components/ui/GameResultOverlay.tsx)

**問題**: 大量の定型duration値（0.1, 0.15, 0.2, 0.3, 0.5など）
**該当箇所**: Line 100-560に多数

**現在の値** (一部抜粋):
```typescript
duration: 0.15  // Line 102
duration: 0.3   // Line 108
duration: 0.5   // Line 120, 132, 205
duration: 0.15  // Line 143, 150, 178
duration: 0.1   // Line 157, 411
duration: 0.35  // Line 185, 490, 529, 535
duration: 0.2   // Line 469, 515, 521, 559
```

**推奨値** (一部抜粋):
```typescript
duration: 0.17  // 0.15の代替
duration: 0.32  // 0.3の代替
duration: 0.48  // 0.5の代替
duration: 0.13  // 0.1の代替
duration: 0.37  // 0.35の代替
duration: 0.23  // 0.2の代替
```

**優先度**: 高（ゲーム結果演出は最も目立つ部分）

**注意**: このファイルは559行の大規模GSAPアニメーション。慎重に修正する必要あり。


### 5. **MobileBottomSheet.tsx** (C:/Users/hr-hm/Desktop/codex/components/ui/MobileBottomSheet.tsx)

**問題**: duration 0.3, 0.2の定型値
**該当箇所**:
- Line 163: `duration: 0.3`
- Line 167: `duration: 0.3`
- Line 184: `duration: 0.2`

**現在の値**:
```typescript
duration: 0.3  // オーバーレイ
duration: 0.3  // スライド
duration: 0.2  // フェードイン
```

**推奨値**:
```typescript
duration: 0.28  // オーバーレイ
duration: 0.31  // スライド
duration: 0.19  // フェードイン
```

**優先度**: 低（モバイル限定UI）


### 6. **グラデーション角度の定型値問題**

**問題**: 135deg, 90deg, 180degなどの完璧な角度が多用されている

**該当箇所**:
- `CreateRoomModal.tsx` Line 409: `135deg`
- `Header.tsx` Line 26: `180deg`
- `ChatPanelImproved.tsx` Line 294: `135deg`
- `DragonQuestNotify.tsx` Line 218: `135deg`
- `DragonQuestParty.tsx` Line 78, 80, 654, 722, etc.: `145deg`, `135deg`, `90deg`, `180deg`
- `MinimalChat.tsx` Line 94: `135deg`
- `MiniHandDock.tsx` Line 662, 791, 810: `135deg`, `180deg`, `90deg`

**推奨対応**:
```typescript
// ❌ 現在
linear-gradient(135deg, ...)
linear-gradient(90deg, ...)
linear-gradient(180deg, ...)

// ✅ 推奨
linear-gradient(137deg, ...)  // 135 → 137
linear-gradient(88deg, ...)   // 90 → 88
linear-gradient(182deg, ...)  // 180 → 182
```

**優先度**: 中（視覚的には目立たないが、多数箇所に影響）


### 7. **PlayerList.tsx** (C:/Users/hr-hm/Desktop/codex/components/PlayerList.tsx)

**問題**: letterSpacing値が定型的（0.073em, 0.015em, 0.018em, 0.021em, 0.012em, 0.008em）
**該当箇所**: Line 64, 126, 138, 150, 162, 182

**現在の値**:
```typescript
letterSpacing="0.073em"  // Line 64
letterSpacing="0.015em"  // Line 126
letterSpacing="0.018em"  // Line 138
letterSpacing="0.021em"  // Line 150
letterSpacing="0.012em"  // Line 162
letterSpacing="0.008em"  // Line 182
```

**推奨値**:
```typescript
letterSpacing="0.071em"  // より自然
letterSpacing="0.016em"
letterSpacing="0.019em"
letterSpacing="0.023em"
letterSpacing="0.013em"
letterSpacing="0.009em"
```

**優先度**: 低（すでに人間的な調整済み）

**備考**: ✅ **実は良好** - 既に0.1em刻みではなく、細かい値で調整されている。修正の優先度は低い。


### 8. **transition値の定型パターン問題**

**問題**: `172ms`, `178ms`, `180ms`, `175ms`など人間的だが、同じ値が複数箇所に
**該当箇所**:
- `PlayerList.tsx` Line 88: `172ms`
- `MiniHandDock.tsx` Line 769: `178ms`, 878: `180ms`, 909: `175ms`, 940: `182ms`, etc.
- `BoardArea.tsx` Line 43: `150ms` - **これは定型的**

**推奨対応**:
```typescript
// MiniHandDock.tsx
transition="178ms cubic-bezier(.2,1,.3,1)"  // ✅ 良好
transition="180ms cubic-bezier(.2,1,.3,1)"  // ✅ 良好
transition="175ms cubic-bezier(.2,1,.3,1)"  // ✅ 良好

// BoardArea.tsx
transition="all 150ms ease"  // ❌ AI感（150ms + ease）
// 推奨: transition="all 147ms cubic-bezier(0.3, 0.1, 0.4, 1)"
```

**優先度**: 低（MiniHandDock.tsxは良好、BoardArea.tsxのみ要修正）


### 9. **GameCard.tsx** (C:/Users/hr-hm/Desktop/codex/components/ui/GameCard.tsx)

**問題**: 完璧な180度回転
**該当箇所**:
- Line 167: `rotateY(180deg)`
- Line 207: `rotateY(180deg)`
- Line 228: `rotateY(180deg)`

**現在の値**:
```typescript
const flipTransform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";
```

**推奨値**:
```typescript
const flipTransform = flipped ? "rotateY(178deg)" : "rotateY(0deg)";
```

**優先度**: 低（カードフリップは180度が自然）

**備考**: カードフリップの場合は180度が最適。変更不要の可能性が高い。


---

## ⚡ パフォーマンス改善候補

### 1. **GameResultOverlay.tsx - 複雑なGSAPタイムライン**

**問題**: 559行の巨大ファイルに、複数の重いGSAPタイムラインが同時実行される可能性
**該当箇所**: Line 42-560（useEffect内の大量のGSAP処理）

**影響**:
- 勝利/失敗演出時に複数のGSAPアニメーションが同時実行
- フラッシュエフェクト、パーティクル、テキストアニメーションが重なる
- 低スペック端末でカクつく可能性

**改善案**:
```typescript
// 現在: 複数のタイムラインが同時実行される可能性
useEffect(() => {
  const tl = gsap.timeline();
  tl.to(...).to(...).to(...); // 大量のチェーン
}, [failed, mode, ...]);

// 推奨: willChangeの活用とアニメーション最適化
useEffect(() => {
  const tl = gsap.timeline({
    defaults: {
      ease: "power2.out",
      overwrite: "auto"  // 既存アニメーションを上書き
    }
  });
  // willChangeをGSAPで自動管理
  gsap.set(element, { willChange: "transform, opacity" });
  tl.to(...).to(...);
  return () => {
    gsap.set(element, { clearProps: "willChange" });
  };
}, [failed, mode]);
```

**優先度**: 中


### 2. **DragonQuestParty.tsx - 大量のプレイヤーカード**

**問題**: プレイヤー数が多い場合（6人）に、各カードのGSAPアニメーションが重い
**該当箇所**: Line 261-290（各プレイヤーカードのGSAPフラッシュ効果）

**影響**:
- 6人全員が同時に「提出完了」状態になった場合、6つのGSAPアニメーションが同時発火
- フラッシュエフェクトが重なるとパフォーマンス低下

**改善案**:
```typescript
// 現在: 各カードごとにuseEffect + GSAP
useEffect(() => {
  if (shouldFlash) {
    gsap.timeline().to(...).to(...);
  }
}, [shouldFlash]);

// 推奨: useMemoでアニメーション条件を最適化
const shouldAnimate = useMemo(() => {
  return shouldFlash && !prefersReducedMotion;
}, [shouldFlash, prefersReducedMotion]);

useEffect(() => {
  if (!shouldAnimate) return;
  // GSAPアニメーション
}, [shouldAnimate]);
```

**優先度**: 低（通常6人以下で問題なし）


### 3. **不要な再レンダリングの可能性**

**問題**: PlayerList.tsxのuseMemo依存配列が文字列結合
**該当箇所**: PlayerList.tsx Line 35

**現在の実装**:
```typescript
useMemo(() => {
  // ...
}, [
  players.map((p) => `${p.id}:${p.ready ? 1 : 0}:${p.clue1 || ""}`).join(","),
]);
```

**影響**: players配列の参照が変わるたびに文字列を再生成 → useMemoの意味が薄れる

**改善案**:
```typescript
// より効率的な依存配列
useMemo(() => {
  // ...
}, [players.length, players.map(p => p.ready).join(), players.map(p => p.clue1).join()]);

// または、useCallbackで最適化
const playerHash = useCallback(() => {
  return players.map((p) => `${p.id}:${p.ready}:${p.clue1}`).join(",");
}, [players]);

useMemo(() => {
  // ...
}, [playerHash()]);
```

**優先度**: 低（実測が必要）


---

## 🎨 UX改善候補

### 1. **DragonQuestLoading.tsx - プログレス表示の精度**

**問題**: プログレス%が整数表示のみ
**該当箇所**: Line 327

**現在の実装**:
```typescript
{Math.round(progress)}%
```

**改善案**:
```typescript
// より詳細な進捗表示
{progress >= 99 ? "99" : Math.floor(progress)}%
```

**優先度**: 低（既存仕様で問題なし）


### 2. **PhaseAnnouncement.tsx - アニメーション過多**

**問題**: フェーズ変更のたびに複雑なGSAPアニメーションが発火
**該当箇所**: Line 42-175

**現在の実装**:
- テキストフェード → アイコン回転 → ボックスパルス → テキストフェードイン → アイコン回転 → バウンス
- 合計6ステップのタイムライン

**改善案**:
```typescript
// よりシンプルな演出（ドラクエ風には「瞬間切り替え」も似合う）
const tl = gsap.timeline();
tl.to(container, {
  scale: 0.95,
  duration: 0.1,
  ease: "power2.in"
})
.to(container, {
  scale: 1,
  duration: 0.15,
  ease: "back.out(1.2)"
});
```

**優先度**: 低（現在の演出も好評）


### 3. **DragonQuestNotify.tsx - 閉じるボタンが小さい**

**問題**: 「×」ボタンのクリック領域が20px × 20pxと小さい
**該当箇所**: Line 273-274

**現在の実装**:
```typescript
w="20px"
h="20px"
```

**改善案**:
```typescript
// クリック領域を拡大（視覚サイズは維持）
w="28px"
h="28px"
fontSize="lg"  // 視覚的には変わらない
```

**優先度**: 中（UX改善）


### 4. **PlayerList.tsx - 長い連想ワードの表示**

**問題**: 連想ワードが3行でクリップされる
**該当箇所**: Line 178 `lineClamp={3}`

**現在の実装**:
```typescript
<Text
  fontSize="sm"
  color={UI_TOKENS.COLORS.whiteAlpha80}
  lineClamp={3}
  overflowWrap="anywhere"
>
  連想ワード: {p.clue1 ? p.clue1 : "（未設定）"}
</Text>
```

**改善案**:
```typescript
// クリックで展開可能にする
const [expanded, setExpanded] = useState(false);

<Text
  fontSize="sm"
  lineClamp={expanded ? undefined : 3}
  onClick={() => setExpanded(!expanded)}
  cursor="pointer"
>
  連想ワード: {p.clue1 ? p.clue1 : "（未設定）"}
</Text>
```

**優先度**: 低（通常3行で十分）


### 5. **Header.tsx - タイトルのletterSpacing**

**問題**: letterSpacing="0.05em"が定型的
**該当箇所**: Line 49

**現在の実装**:
```typescript
letterSpacing="0.05em"
```

**推奨値**:
```typescript
letterSpacing="0.048em"  // より自然
```

**優先度**: 低


### 6. **CreateRoomModal.tsx - パスワード入力のUX**

**問題**: パスワードが4桁固定だが、入力中のフィードバックが弱い
**該当箇所**: Line 115-127

**改善案**:
```typescript
// リアルタイムバリデーション表示
{enablePassword && (
  <>
    <GamePasswordInput
      value={password}
      onChange={(e) => {
        const val = e.target.value;
        setPassword(val);
        // リアルタイムで文字数表示
        if (val.length === 4 && /^\d{4}$/.test(val)) {
          setPasswordError(null);
        }
      }}
    />
    <Text fontSize="xs" color="textMuted">
      {password.length}/4桁
    </Text>
  </>
)}
```

**優先度**: 低（既存仕様で問題なし）


### 7. **GameCard.tsx - カードフリップの回転方向**

**問題**: 常に同じ方向に回転（Y軸180度）
**該当箇所**: Line 167

**改善案**:
```typescript
// ランダムに回転方向を変える（より自然）
const flipDirection = useMemo(() => Math.random() > 0.5 ? 1 : -1, []);
const flipTransform = flipped
  ? `rotateY(${180 * flipDirection}deg)`
  : "rotateY(0deg)";
```

**優先度**: 低（現在の一方向回転も自然）


---

## ✅ 問題なし・良好なコンポーネント

### 1. **MiniHandDock.tsx** - ✅ 修正済み
- **理由**: transition値が `172ms`, `178ms`, `180ms`, `175ms`, `182ms`など人間的な値に調整済み
- **参考**: Line 769, 878, 909, 940, 1041, 1096, 1154, 1183, 1218, 1252, 1280, 1308
- **状態**: 非常に良好。AI感ゼロ。

### 2. **SimplePhaseDisplay.tsx** - ✅ 修正済み
- **理由**: duration値が `0.58`, `0.17`, `0.18`, `0.11`, `0.28`, `0.37`, `0.14`, `0.27`, `0.36`など不規則
- **参考**: Line 87, 109, 118, 131, 139, 148, 156, 220, 226
- **状態**: 非常に良好。AI感ゼロ。

### 3. **DiamondNumberCard.tsx** - ✅ 修正済み
- **理由**: duration値が `0.17`, `0.12`, `0.34`, `0.13`など不規則
- **参考**: Line 47, 53, 58, 67
- **状態**: 良好。

### 4. **theme/semantic/colors.ts** - ✅ 良好
- **理由**: セマンティックカラーが適切に定義され、コメント付き
- **状態**: 問題なし。WCAG AAA準拠コメントも適切。

### 5. **theme/recipes/button.recipe.ts** - ✅ 良好
- **理由**: ボタンバリアントが適切に設計され、transition値も120msと人間的
- **状態**: 問題なし。

### 6. **theme/layout.ts** - ✅ 良好
- **理由**: 統一レイアウトシステムが適切に設計され、DPI対応も完璧
- **状態**: 非常に良好。Agent-friendly設計。

### 7. **DragonQuestParty.tsx** - ✅ ほぼ良好
- **理由**: グラデーション角度が`145deg`など微妙にずれている部分もある
- **問題**: `90deg`, `135deg`, `180deg`の定型値も混在
- **状態**: 概ね良好だが、グラデーション角度を統一的に微調整すると更に良い。

### 8. **PlayerList.tsx** - ✅ 良好
- **理由**: letterSpacingが `0.073em`, `0.015em`など細かく調整済み
- **問題**: transition値が`172ms`（良好）
- **状態**: 非常に良好。

### 9. **toaster.tsx** - ✅ 良好
- **理由**: duration値が `0.3`だが、トースト通知の標準的な値
- **状態**: 問題なし。

### 10. **UniversalGamePanel.tsx** - ✅ ほぼ良好
- **理由**: duration値が `0.2`, `0.3`, `0.1`だが、シンプルなパネルアニメーションには適切
- **状態**: 問題なし。


---

## 📈 優先度別修正ロードマップ

### 🔴 高優先度（目立つ・影響大）

1. **PhaseAnnouncement.tsx** - アイコン回転角度の修正
   - `360°` → `354°`
   - `180°` → `173°`
   - duration値も微調整

2. **GameResultOverlay.tsx** - 大量のduration値修正
   - 0.1, 0.15, 0.2, 0.3, 0.5 → 不規則な値に変更
   - GSAPタイムラインの最適化

3. **グラデーション角度の統一修正**
   - 全ファイルの`135deg`, `90deg`, `180deg`を微調整


### 🟡 中優先度（改善推奨）

1. **DragonQuestLoading.tsx** - duration値の微調整
2. **DragonQuestNotify.tsx** - duration値の微調整
3. **GameResultOverlay.tsx** - パフォーマンス最適化
4. **DragonQuestNotify.tsx** - 閉じるボタンのクリック領域拡大


### 🟢 低優先度（余裕があれば）

1. **MobileBottomSheet.tsx** - duration値の微調整
2. **BoardArea.tsx** - transition値の微調整
3. **Header.tsx** - letterSpacing微調整
4. **PlayerList.tsx** - 長い連想ワードの展開機能
5. **GameCard.tsx** - カードフリップの回転方向ランダム化


---

## 🎯 修正の具体的ガイドライン

### Duration値の修正パターン

```typescript
// ❌ AI感が強い値
0.1  → 0.11 or 0.13
0.15 → 0.17 or 0.14
0.2  → 0.19 or 0.21 or 0.23
0.3  → 0.27 or 0.28 or 0.31
0.35 → 0.37 or 0.38 or 0.33
0.5  → 0.46 or 0.48 or 0.52

// ✅ 人間的な値（参考: SimplePhaseDisplay.tsx）
0.58, 0.17, 0.18, 0.11, 0.28, 0.37, 0.14, 0.27, 0.36
```

### 角度の修正パターン

```typescript
// ❌ AI感が強い角度
45deg   → 43deg or 47deg
90deg   → 88deg or 92deg
135deg  → 137deg or 133deg
180deg  → 178deg or 182deg
360deg  → 354deg or 357deg

// ✅ 人間的な角度
145deg, 137deg, 88deg, 173deg, 354deg
```

### LetterSpacingの修正パターン

```typescript
// ❌ AI感が強い値
0.5em  → 0.48em or 0.52em
1em    → 0.97em or 1.03em
1.5em  → 1.47em or 1.53em

// ✅ 人間的な値（参考: PlayerList.tsx）
0.073em, 0.015em, 0.018em, 0.021em, 0.012em, 0.008em
```


---

## 💡 総評

### 全体的な品質

**非常に良好** - 多くのコンポーネントは既に人間的な調整が施されており、AI感は少ない。

### 特に優れている点

1. **MiniHandDock.tsx** - transition値が完璧に調整済み
2. **SimplePhaseDisplay.tsx** - duration値が非常に自然
3. **DiamondNumberCard.tsx** - duration値が適切に不規則
4. **theme/layout.ts** - 統一システムが優れている
5. **PlayerList.tsx** - letterSpacingが細かく調整済み

### 改善の余地がある点

1. **PhaseAnnouncement.tsx** - 完璧な角度が目立つ
2. **GameResultOverlay.tsx** - 大量の定型duration値
3. **グラデーション角度** - 複数ファイルで定型値が多用
4. **一部のduration値** - 0.1刻みの定型値が残存

### 推奨される次のアクション

1. **高優先度の3項目**を先に修正
2. **中優先度の項目**を段階的に改善
3. **低優先度の項目**は余裕があれば対応

### 修正による期待効果

- **AI感の完全排除** - より人間的なデザインに
- **視覚的な自然さ向上** - 微妙な不規則性が生む有機的な印象
- **ドラクエ風との整合性維持** - レトロ感を保ちつつモダンに

---

## 📝 付録: 修正テンプレート

### PhaseAnnouncement.tsx修正例

```typescript
// Before
.to(iconEl, {
  rotation: 360,
  duration: 0.8,
  ease: "elastic.out(1, 0.5)",
  delay: 0.4,
});

// After
.to(iconEl, {
  rotation: 354,  // 360 → 354
  duration: 0.83, // 0.8 → 0.83
  ease: "elastic.out(1, 0.5)",
  delay: 0.42,    // 0.4 → 0.42
});
```

### GameResultOverlay.tsx修正例

```typescript
// Before
duration: 0.5,

// After
duration: 0.48,

// Before
duration: 0.15,

// After
duration: 0.17,
```

### グラデーション修正例

```typescript
// Before
background: "linear-gradient(135deg, rgba(12,14,20,0.95) 0%, rgba(18,20,28,0.92) 100%)"

// After
background: "linear-gradient(137deg, rgba(12,14,20,0.95) 0%, rgba(18,20,28,0.92) 100%)"
```

---

**調査完了日**: 2025-10-03
**次回調査推奨**: 修正実施後
