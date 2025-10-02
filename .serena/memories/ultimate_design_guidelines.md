# Ultimate Design Guidelines

## 高優先度チェックリスト（即実装）

### 余白・レイアウト
- ✅ 余白は4の倍数だけにしない → セクション境界に **+3px/-1px**
- ✅ 上下余白を非対称に → 視線の流れを作る `pt:"14px", pb:"22px"`
- ✅ セクション余白を連続均一にしない → 章頭だけ+12px
- ✅ CTA周りの余白を広めに → `mx:"-2px", p:"18px 22px"`

### タイポグラフィ
- ✅ 行間を全段落同じにしない → 見出し/本文/注釈で差をつける
- ✅ フォントサイズに奇数を混ぜる → `15/17/19px` 混在
- ✅ 長文の最長行を制限 → **60–80字** 目安 `maxW:"68ch"`
- ✅ 数字と本文を同書体にしない → 数字は等幅 `fontFeatureSettings:"tnum"`

### ボタン・インタラクション
- ✅ 角丸を役割で変える → 主/副/危険で半径差 `3px/6px/10px`
- ✅ ホバーは影だけにしない → 微小上移動+摩擦 `translateY(-1px)`
- ✅ 押下エフェクトを追加 → 押し込み影 `translateY(1px)`
- ✅ フォーカスリングを調整 → 配色/太さ `2-3px`

### 影・深度
- ✅ 影を全カード同一にしない → 面積×重要度で段差
- ✅ カード影は2層以上 → `0 1px 0 rgba(...), 0 12px 22px -10px rgba(...)`
- ✅ ダークモードで影を浅く → `useColorModeValue`

### フォーム
- ✅ ラベルと入力の間隔確保 → **8〜14px** `gap:"11px"`
- ✅ トグル/チェックのタップ領域拡張 → **minH:"40px"**
- ✅ エラー表示を強化 → 色+テキスト+アイコン+残存時間

### アニメーション
- ✅ ease-in-out固定を避ける → `cubic-bezier(.2,1,.3,1)`
- ✅ Tooltip遅延を追加 → `openDelay={180}`
- ✅ アコーディオンに慣性 → 不等速+小overshoot

## コンポーネント別ガイドライン

### Buttons
```tsx
// 主ボタン: 押し込み感
<Button
  sx={{
    borderRadius: "3px",
    letterSpacing: "0.02em",
    px: "17px", py: "11px",
    boxShadow: "2px 3px 0 rgba(0,0,0,.28)",
    transition: "180ms cubic-bezier(.2,1,.3,1)"
  }}
  _hover={{ transform: "translateY(-1px)" }}
  _active={{ transform: "translateY(1px)" }}
/>
```

### Cards
```tsx
// 上下非対称余白 + 多層影
<Box
  sx={{
    p: "19px 22px",
    borderRadius: "7px",
    boxShadow: "0 1px 0 rgba(0,0,0,.06), 0 12px 22px -10px rgba(0,0,0,.18)"
  }}
  _dark={{
    boxShadow: "0 1px 0 rgba(255,255,255,.04), 0 8px 18px -10px rgba(0,0,0,.5)"
  }}
/>
```

### Navigation (現在地表示)
```tsx
// 左3pxインジケータ + 余白増
<HStack position="relative" sx={{ pl:"14px" }}>
  <Box
    position="absolute"
    left="0"
    top="8%"
    bottom="8%"
    bg="blue.500"
    w="3px"
    borderRadius="2px"
  />
  <Text fontWeight="600">ダッシュボード</Text>
</HStack>
```

### Modal Header
```tsx
// 内側影 + 字間で緊張感
<ModalHeader
  sx={{
    letterSpacing: "-0.003em",
    boxShadow: "inset 0 -1px 0 rgba(0,0,0,.08)",
    pb: "13px"
  }}
/>
```

### Tables
- 偶奇ストライプ + 奇数列px微差
- ヘッダと本文で明度差10-18%
- ヘッダ下に内側影

## 実装テクニック

### テーマ設定（奇数px許容）
```ts
export const theme = extendTheme({
  fontSizes: { xs:"13px", sm:"15px", base:"17px", lg:"19px" },
  radii: { sm:"3px", md:"7px", pill:"9999px" },
  shadows: {
    cardSm: "0 1px 0 rgba(0,0,0,.06)",
    cardMd: "0 1px 0 rgba(0,0,0,.06), 0 12px 22px -10px rgba(0,0,0,.18)"
  },
  transition: { hand: "180ms cubic-bezier(.2,1,.3,1)" }
});
```

### アニメーション（不等間隔）
```ts
const flicker = keyframes`
  0%, 100% { opacity: .92 }
  7% { opacity: .82 }
  13% { opacity: .96 }
  21% { opacity: .78 }
  34% { opacity: .9 }
`;
```

### CSS変数でゆらぎ管理
```tsx
<Box sx={{
  "--j": ".5px",
  transform: "translate(var(--j), calc(var(--j)*-1))"
}} />
```

## よくある"こうじゃない感"

1. **行間が文字サイズに対して均一すぎ**
2. **角丸・影の全部同じ**
3. **配色が面積と役割に対して過剰**
4. **余白がグループ境界を作れていない**

## Next.js + Chakra UI 注意点

- ⚠️ SSRとランダム → 固定微差で表現（ハイドレーション崩れ回避）
- ⚠️ ColorModeフラッシュ → `ColorModeScript` 正しく配置
- ⚠️ モーション削減 → `prefers-reduced-motion` 対応必須

## Phase別実装の流れ

1. **Phase 1**: 余白 → 文字 → 色 → 動き
2. **Phase 2**: 均一箇所に僅差の不均一を注入
3. **Phase 3**: 文脈一貫 × 粗密 × 微差 × 違和感潰し
4. **Phase 4**: トークン運用 + ローカル崩しの二段構え
5. **Phase 5**: 高優先度から処理（可読・操作・意味優先）
6. **Phase 6**: 具体的数値で"手"を感じさせる
