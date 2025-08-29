# 🎨 デザイン刷新指示書

## 🚨 **重要警告**
**既存のロジック・ボタン・機能を絶対に削除・変更しないこと**

## 📋 **ミッション概要**

### **主要目標**
- DPI 125%スケーリング対応
- ウィンドウリサイズ時のUI崩れ修正
- カードボードエリアの上部カットオフ問題解決
- スクロール発生の完全排除

### **デザイン方針**
- Nintendo品質のコンソールゲームUI
- 3カラムレイアウト（左：プレイヤー、中央：ゲームボード、右：チャット）
- 底部手札エリア
- viewport固定（`100dvh`使用）

## 🔧 **実装アプローチ**

### **推奨手順**
1. **既存機能の完全把握**
   - 全てのボタン・コンポーネントをリスト化
   - 現在動作している機能を網羅的に確認
   
2. **段階的デザイン刷新**
   - 機能を一切触らずCSS/レイアウトのみ変更
   - 既存コンポーネントの props は絶対に変更しない
   
3. **検証と調整**
   - 全機能が正常動作することを確認
   - DPI・リサイズ対応テスト

## 🚫 **絶対禁止事項**

### **削除・変更禁止リスト**
- ホスト操作ボタン群（ゲーム開始、お題選択、数字配布等）
- 既存のゲーム進行ロジック
- useRoomState, useHostActions 等のフック
- TopicShuffleButton, NumberDealButton コンポーネント
- AdvancedHostPanel との連携
- 既存の notify システム
- Firebase 関連の処理

### **変更禁止コンポーネント**
```
- /components/ui/HostControlDock.pc.tsx（完全動作中）
- /components/ui/NumberDealButton.tsx
- /components/ui/TopicShuffleButton.tsx
- /components/ui/AdvancedHostPanel.tsx
- /components/hooks/useHostActions.ts
```

## 📐 **デザイン仕様**

### **レイアウト構造**
```css
Grid Template:
templateColumns: "280px 1fr 340px"
templateRows: "auto 1fr 140px"
templateAreas:
  "header header header"
  "left center right" 
  "hand hand hand"
```

### **エリア役割**
- **Header**: ゲームタイトル・設定・オンライン数
- **Left**: プレイヤーリスト（スクロール可）
- **Center**: カードボード（スクロール禁止）
- **Right**: チャット機能
- **Hand**: 手札・ヒント入力・**ホスト操作ボタン**

## 💡 **実装戦略**

### **🚨 CSS残骸クリーンアップ必須**

#### **事前クリーンアップ**
```bash
# 古いCSS残骸を一掃
rm -rf .next/
npm run build  # ビルドキャッシュをクリア
```

#### **CSS残骸対策**
1. **globals.css の整理**
   - 不要な grid レイアウト定義削除
   - 古い viewport 固定 CSS 削除
   - 使われていない utility クラス削除

2. **Chakra UI v3 移行残骸**
   - `spacing` → `gap` 変更漏れチェック
   - `align` → `alignItems` 変更漏れチェック
   - 古い colorScheme 指定削除

3. **動的 className 競合回避**
   - 古い CSS-in-JS スタイルと新規の競合排除
   - `!important` の乱用を避ける

### **Option A: CSS刷新アプローチ（推奨）**
1. **Step 1**: 既存CSS完全削除
   ```bash
   # カスタムCSS一時バックアップ
   cp app/globals.css app/globals.css.backup
   # 最小限のリセットのみ残す
   ```
2. **Step 2**: 既存JSXは一切触らない
3. **Step 3**: Chakra UI props のみで新レイアウト構築
4. **Step 4**: レスポンシブ対応を追加

### **Option B: レイアウト再構築アプローチ（上級者向け）**
1. **既存コンポーネントをimportして配置し直す**
2. 既存の props は一切変更しない
3. レイアウト用のWrapper要素で囲むのみ
4. **CSS残骸は完全削除してChakra UIのみ使用**

## 🎯 **成功基準**

### **必須条件**
- [ ] DPI 125% で正常表示
- [ ] ウィンドウリサイズでUI崩れなし
- [ ] カードボード上部カットオフ解決
- [ ] スクロール完全排除
- [ ] **全ホスト操作ボタンが動作**
- [ ] ゲーム進行ロジック正常動作
- [ ] **CSS残骸ゼロ（重要）**
- [ ] **ビルド警告ゼロ**

### **品質基準**
- [ ] Nintendo品質のUI/UX
- [ ] 直感的なレイアウト
- [ ] アクセシビリティ対応
- [ ] **スタイル競合なし**

### **CSS品質チェック**
```bash
# 最終確認コマンド
npm run build  # 警告ゼロ確認
npm run lint   # エラーゼロ確認
du -sh .next/  # ビルドサイズ確認
```

## 📂 **参考ファイル**

### **必読ファイル**
- `docs/UI.md` - デザイン仕様
- `docs/itorule.md` - ゲームルール
- `docs/GAME_LOGIC_OVERVIEW.md` - 現在のロジック

### **保護対象ファイル**
- `components/ui/HostControlDock.pc.tsx` ⚠️完璧動作中
- `components/hooks/useHostActions.ts` ⚠️必須フック
- `lib/game/room.ts` ⚠️ゲームロジック中核

### **CSS残骸除去対象ファイル**
- `app/globals.css` - カスタムグリッド・viewport定義削除
- `components/**/*.module.css` - 未使用CSSモジュール
- `.next/` - ビルドキャッシュ（削除推奨）

### **Chakra UI v3 移行チェック**
```bash
# 残骸パターン検索
grep -r "spacing=" components/
grep -r "align=" components/ 
grep -r "colorScheme" components/
```

## ⚡ **効率化のヒント**

### **トークン節約術**
1. 既存コンポーネントは**import して使う**だけ
2. 新規実装は**CSS/レイアウトのみ**
3. ロジック変更は**絶対に行わない**

### **推奨フロー**
```
1. 既存機能リスト化 → 2. レイアウト設計 → 3. CSS実装 → 4. 動作確認
```

## 🔥 **最終警告**

**「デザイン刷新 ≠ 機能削除」**

- 見た目だけ変える
- 機能は絶対に触らない  
- 既存ボタンは全て保持
- ロジックは完璧なので活用せよ

**失敗 = 全機能消失 = 大量トークン浪費**
**成功 = 美しいUI + 完全動作 = 効率達成**

---

## 🧹 **CSS残骸完全除去戦略**

### **段階的クリーンアップ**
1. **Phase 1**: ビルドキャッシュクリア
   ```bash
   rm -rf .next/ node_modules/.cache/
   npm run build
   ```

2. **Phase 2**: カスタムCSS最小化
   ```css
   /* globals.css - 最小限のみ残す */
   :root {
     --font-geist-sans: /* フォント定義のみ */;
   }
   
   /* 古いgrid、viewport、utilityクラスは全削除 */
   ```

3. **Phase 3**: Chakra UI v3完全移行
   - `spacing` → `gap` 全置換
   - `align` → `alignItems` 全置換  
   - `colorScheme` → `colorPalette` 全置換

### **残骸検出スクリプト**
```bash
# 古いChakra UI props検索
find components/ -name "*.tsx" -exec grep -l "spacing\|align=\|colorScheme" {} \;

# 未使用CSS検索
find . -name "*.module.css" -not -path "./node_modules/*"
```

### **推奨フロー**
1. **CSS完全削除** → 2. **Chakra UI v3のみ** → 3. **機能確認** → 4. **デザイン調整**

**結論**: CSS残骸ゼロ状態から始めることで、競合・スタイル汚染を根本回避