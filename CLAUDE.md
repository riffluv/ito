# 🎯 Claude Code 指示書

## 📋 **メイン ミッション**


**あなたの使命**
[text](docs/GAME_LOGIC_OVERVIEW.md) を見て現在のプロジェクトのロジック改善点などありますか？


## 📚 **必読資料**

### **最優先参照ファイル**

- **`CLAUDE.md`** ← この指示書（現在のファイル）
[text](docs/GAME_LOGIC_OVERVIEW.md) ←現在のitoゲームの仕様です


## 🚨 **重要: テーマシステム決定事項**

### **ダークモード固定決定**

**2025-09-01に変更**: このプロジェクトは**ダークモード専用**に確定しました。

#### **重要な決定理由**
- 黒ベースのデザインでゲーム画面が引き締まって見える
- 長時間プレイでも目に優しい
- 保守性の向上（テーマ切り替えロジック除去）
- 今後のエージェント作業での一貫性確保

#### **⚠️ 将来のエージェント向け重要警告**

**絶対に以下を行わないでください:**

1. **`_light` プロパティの再導入**
   - すべて除去済み。再追加は UI 破綻を引き起こします
   - `theme/index.ts`, `theme/recipes/*.ts` から完全除去済み

2. **ライトモード機能の復活**
   - `next-themes` プロバイダーは意図的に除去済み
   - `ThemeToggle` コンポーネントは無効化済み

3. **条件付きテーマトークンの使用**
   ```typescript
   // ❌ 絶対に使用禁止
   bg: { base: "gray.900", _light: "white" }
   
   // ✅ 正しい形式（ダークモード固定）
   bg: "gray.900"
   ```

#### **現在の実装状態**
- ✅ `theme/semantic/colors.ts`: 全semantic tokensでダークモード専用色を定義
- ✅ `theme/recipes/button.recipe.ts`: 全variantでダークモード専用
- ✅ `components/site/Hero.tsx`: bgGradientダークモード固定  
- ✅ `components/site/LobbySkeletons.tsx`: skeleton colorダークモード固定
- ✅ `app/providers.tsx`: DarkModeOnlyBridge実装
- ✅ `components/site/ThemeToggle.tsx`: 機能無効化済み

#### **質問時の対応**
もしユーザーからライトモード関連の要求があった場合:

1. この決定事項セクションを参照
2. ダークモード固定の理由を説明  
3. UI破綻リスクを警告
4. 代替提案（コントラスト調整など）を提示

**この決定は最終確定です。変更には十分な理由が必要です。**

