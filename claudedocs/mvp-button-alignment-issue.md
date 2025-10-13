# MVP投票ボタンの右揃え問題

## 問題の概要
`components/ui/MvpLedger.tsx`のMVP列にある投票ボタンが左側に表示されてしまう。
数字列は右揃えで正しく表示されているが、投票ボタンだけが中央～左寄りになっている。

## 現在の状況
- ファイル: `C:\Users\hr-hm\Desktop\codex\components\ui\MvpLedger.tsx`
- 問題の行: 594-686行目（MVP / 投票統合列）
- コード反映確認済み: ボタンテキストを「投票TEST」に変更したら反映されたので、コード自体は更新されている

## 試したこと（すべて効果なし）
1. 親Boxを`display: flex`, `justifyContent: flex-end`に変更
2. 投票ボタンに`ml="auto"`を追加
3. 親Boxに`style={{ display: 'flex', justifyContent: 'flex-end' }}`でインラインスタイル追加
4. 行のGridから`justifyItems="center"`を削除しようとした（ユーザーが元に戻した）
5. NO列とアバター列に`justifySelf="center"`を追加

## 開発者ツールで確認した内容
投票ボタンのスタイル（`.css-1f7cpt4`）:
```css
.css-1f7cpt4 {
    display: inline-flex;
    margin-left: auto;  /* ← 適用されている */
    /* その他のスタイル */
}
```
`margin-left: auto`は適用されているのに、ボタンが右に移動していない。

## 根本原因の推測
1. **Grid の `justifyItems: center`が全セルに影響している**
   - 460行目: `justifyItems="center"`が各行のGridに設定されている
   - これにより、MVP列の`justifySelf="end"`が設定されていても効果がない可能性

2. **親Flexコンテナの幅の問題**
   - MVP列のBox（594行目）が`w="100%"`でも、実際の計算幅が狭い可能性
   - Gridセル自体の配置に問題がある

3. **Chakra UIのスタイルシステムの上書き問題**
   - Chakra UIの内部スタイルが何かを上書きしている可能性

## 正しい解決アプローチ

### 方法1: GridのjustifyItemsを完全に削除
```tsx
// 456-460行目を修正
display="grid"
gridTemplateColumns={columnTemplate}
gap={{ base: "7px", md: "11px" }}
alignItems="center"
// justifyItems="center" を削除
```

そして、各列で個別に`justifySelf`を設定:
- NO列: `justifySelf="center"`
- アバター列: `justifySelf="center"`
- なかま列: `justifySelf="start"` (既に設定済み)
- 連想語列: `justifySelf="start"` (既に設定済み)
- 数字列: `justifySelf="end"` (既に設定済み)
- **MVP列: `justifySelf="end"`に変更**

### 方法2: MVP列のコンテナをBoxからFlexに変更
```tsx
// 594行目のBoxをFlexに変更し、完全に右揃えを強制
<Flex
  direction="row"
  justify="flex-end"
  align="center"
  justifySelf="end"
  w="100%"
  gap="4px"
  pr={{ base: "8px", md: "12px" }}
>
```

### 方法3: CSS Gridの配置を直接制御
```tsx
// 594行目
<Box
  justifySelf="end"
  display="flex"
  justifyContent="flex-end"
  alignItems="center"
  w="auto"  // 100%ではなくautoに変更
  gap="4px"
  pr={{ base: "8px", md: "12px" }}
>
```

## 重要な確認ポイント
1. 開発者ツールでMVP列のBox（親コンテナ）のスタイルを確認
   - `display: flex`が適用されているか
   - `justify-content: flex-end`が適用されているか
   - `width`が実際にどれくらいか

2. 投票ボタン（Button）のスタイルを確認
   - `margin-left: auto`が適用されているか
   - `display: inline-flex`になっているか

3. Gridセル自体の配置を確認
   - MVP列のセルが`justify-self: end`になっているか
   - セルの実際の幅とコンテンツの幅の差

## 期待される結果
投票ボタンが数字列と同じように右揃えで表示される。
MVP表示（絵文字 + ★数字）も右揃えで表示される。

## 参考: 数字列の正しい実装（581-592行目）
```tsx
<Box
  textAlign="right"
  justifySelf="end"
  w="100%"
  fontSize={{ base: "15px", md: "17px" }}
  fontWeight={700}
  textShadow="1px 1px 0 rgba(0,0,0,0.7)"
  pr={{ base: "8px", md: "12px" }}
>
  {typeof player.number === "number" ? player.number : "?"}
</Box>
```
この実装は正しく右揃えになっている。MVP列も同様の構造にすべき。
