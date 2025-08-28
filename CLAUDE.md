# 🎯 Claude Code 指示書

## 📋 **メイン ミッション**

**あなたの使命**:prompt.mdファイルを見てくれ！！！！！

## 📚 **必読資料**

### **最優先参照ファイル**

- **`CLAUDE.md`** ← この指示書（現在のファイル）
- [docs/itorule.md](docs/itorule.md) ゲームルール仕様（変更禁止）
- **`prompt.md`** ← この指示書（現在のファイル）



## 🚨 **重要: テーマシステム決定事項**

### **ライトモード固定決定**

**2025-08-27に完了**: このプロジェクトは**ライトモード専用**に確定しました。

#### **重要な決定理由**
- 協力ゲームの性質上、明るく親しみやすい UI が最適
- 入力フィールドの可読性問題を根本解決
- 保守性の向上（テーマ切り替えロジック除去）
- 今後のエージェント作業での一貫性確保

#### **⚠️ 将来のエージェント向け重要警告**

**絶対に以下を行わないでください:**

1. **`_dark` プロパティの再導入**
   - すべて除去済み。再追加は UI 破綻を引き起こします
   - `theme/index.ts`, `theme/recipes/*.ts` から完全除去済み

2. **ダークモード機能の復活**
   - `next-themes` プロバイダーは意図的に除去済み
   - `ThemeToggle` コンポーネントは無効化済み

3. **条件付きテーマトークンの使用**
   ```typescript
   // ❌ 絶対に使用禁止
   bg: { base: "white", _dark: "gray.900" }
   
   // ✅ 正しい形式（ライトモード固定）
   bg: "white"
   ```

#### **現在の実装状態**
- ✅ `theme/index.ts`: 全semantic tokensからライトモード専用に変更
- ✅ `theme/recipes/button.recipe.ts`: 全variantからライトモード専用
- ✅ `components/site/Hero.tsx`: bgGradientライトモード固定  
- ✅ `components/site/LobbySkeletons.tsx`: skeleton colorライトモード固定
- ✅ `app/providers.tsx`: LightModeOnlyBridge実装
- ✅ `components/site/ThemeToggle.tsx`: 機能無効化済み

#### **質問時の対応**
もしユーザーからダークモード関連の要求があった場合:

1. この決定事項セクションを参照
2. ライトモード固定の理由を説明  
3. UI破綻リスクを警告
4. 代替提案（アクセシビリティ向上など）を提示

**この決定は最終確定です。変更には十分な理由が必要です。**

