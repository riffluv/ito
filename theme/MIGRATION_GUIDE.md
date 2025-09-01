# デザインシステム移行ガイド (Chakra UI v3)

目的: 現行 UI を壊さずにトークン指向 + recipes 指向へ段階移行し、エージェント提案と実装乖離を最小化する。

---

## フェーズ概要

| Phase | 目標         | 主作業                                                   | 完了判定                                    |
| ----- | ------------ | -------------------------------------------------------- | ------------------------------------------- |
| 0     | 基盤分割     | `foundations/*` / `semantic/*` 追加                      | ビルド成功 & 既存画面視覚差異なし           |
| 1     | 直接値排除   | 主要 UI の raw CSS 値 (色/幅/影/角丸) を tokens 参照化   | grep で `#` 直書き/`px` サイズの 80% 削減   |
| 2     | Recipes 集約 | Button/Card/Toast/Panel を recipe/slot recipe 経由で統一 | 呼び出しコードから複雑な style props が削減 |
| 3     | Strict 化    | `strictTokens: true` + `chakra typegen` 導入             | 未定義トークン使用が型エラーになる          |
| 4     | Preset 拡張  | 複数配色 preset 差し替え検証                             | `/design/preview` で切替時エラーなし        |

---

## 詳細ステップ

### Phase 0 → 1: 生CSS検出

```bash
# 直値色/長さスキャン (簡易)
grep -R "#[0-9A-Fa-f]\{3,6\}" components/ app/ | grep -v ".test" || true
grep -R "px\"" components/ app/ | grep -v "theme" | head
```

分類して tokens 不足を特定 → `theme/index.ts` に追加 or semantic 化。

### Phase 1 置換ポリシー

| 種類     | 旧例                         | 新例                                         |
| -------- | ---------------------------- | -------------------------------------------- |
| 色       | `#ff7a1a`                    | `{colors.orange.500}` or semantic (`accent`) |
| 角丸     | `borderRadius="8px"`         | `rounded="md"`                               |
| 影       | `boxShadow="0 4px 10px ..."` | `shadow="md"` or semantic (`elevated`)       |
| border幅 | `borderWidth="1px"`          | `borderWidth="thin"`                         |
| gradient | インライン                   | tokens.gradients._ or semanticGradients._    |

### Phase 2: recipes 利用

1. `useRecipe({ key: 'button' })` へ移行 or `chakra('button', buttonRecipe)` の直接利用統一。
2. `slotRecipes.panel` 作成 → 既存 Panel 実装の header/body/footer を slot 化。
3. variant 乱立防止: 追加時は `DESIGN_GUIDE.md` に variant 名追記必須にする。

### Phase 3: strictTokens + 型生成

```bash
npx @chakra-ui/cli typegen theme/index.ts --outdir types
```

CI で差分検出: `git diff --exit-code types/` を lint ステップに追加。

### Phase 4: Theme Preset 拡張

- `ThemePresetContext` に `registerPreset` ユーティリティ追加。
- 新配色は brand パレット 50-900 を先に埋め、その後 semanticColors の差分上書き。

---

## ESLint ルール案 (概念)

カスタムルール例:

- `no-raw-color`: `/#([0-9a-f]{3,6})/i` を style props/`sx` で検出しエラー。
- `no-px-border-radius`: `borderRadius` に `px` 直値があれば報告。

運用までの暫定は `eslint --max-warnings=0` と grep レポート。

---

## Codemod (簡易正規表現例)

| 目的          | コマンド例                                                                           |
| ------------- | ------------------------------------------------------------------------------------ |
| 8px → md 半径 | `sed -i "s/borderRadius=\"8px\"/rounded=\"md\"/g" $(git ls-files '*.{tsx,ts}')`      |
| 1px → thin    | `sed -i "s/borderWidth=\"1px\"/borderWidth=\"thin\"/g" $(git ls-files '*.{tsx,ts}')` |

(Windows PowerShell 用は別途 `Get-ChildItem -Recurse` で対応。破壊的変更前に必ずブランチを切る。)

---

## チェックリスト (PR テンプレ例)

- [ ] 新規/変更トークンは `DESIGN_GUIDE.md` に追記した
- [ ] recipes 追加時 `defaultVariants` を設定した
- [ ] raw color / shadow 直書きが追加されていない
- [ ] typegen 再実行済 (`types/` 差分なし)
- [ ] `/design/preview` で視覚回帰なし (手動確認)

---

## よくある落とし穴

| 症状                                    | 原因                    | 対処                                |
| --------------------------------------- | ----------------------- | ----------------------------------- |
| `Token "xxx" not found`                 | strictTokens で未登録   | tokens or semanticTokens に追加     |
| HMR 後に recipe スタイル消失            | key 変更や export ミス  | `theme.recipes` のキー確認 / 再起動 |
| ダークモード不要だが `_dark` 出力される | semantic token 想定構造 | 値を base のみにする（現状 OK）     |

---

## 次の拡張候補

- Panel slot recipe 実装
- Toast variant (success/danger/info) semantic 化
- GameCard flip アニメーションの reduced-motion 対応条件追加
- colorPalette を使った一時イベントテーマ (seasonal) の PoC

---

## 参考

公式ドキュメント: `chakra-ui.com/docs/theming/*` (v3 系)
