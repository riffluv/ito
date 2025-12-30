---
name: design-audit
description: UI Core Spec に基づいてコードをチェックし、AI臭さ/Web臭さを排除
---

# デザイン監査スキル

## 目的
変更されたコードが `docs/UI_CORE_SPEC.md` の基準（AI感/Web感排除）を満たしているか検証する。

## 実行手順

### 1. 参照ドキュメント読み込み
- MUST: `docs/UI_CORE_SPEC.md`
- ALSO: `STYLE_GUIDE.md`, `theme/DESIGN_GUIDE.md`
- OPTION（テーマが指定されている場合のみ）: `docs/ui_theme/hd2d_pack.md`

### 2. 変更ファイルの特定
- git diff または指定されたファイルを対象
- UI/スタイル関連のみをチェック対象とする

### 3. チェック項目 (優先度高のみ抜粋)

#### 🔴 **CRITICAL (必須)**
- [ ] ボタンが“物体”になっている（face/rim/bevel/cast の4要素）
- [ ] pressed が沈む（`translateY(1px)`）＋影/ベベルが変わる（色だけ禁止）
- [ ] focus-visible が二重リングで統一（外2px＋内1px）かつ hover より強い
- [ ] disabled が opacity だけになっていない（影/ハイライトを消して“死んだ道具”にする）
- [ ] Primary が 1画面1つ（複数 Primary 乱立を避ける）
- [ ] pointer: coarse（モバイル）でヒット領域 44〜48 を満たす（見た目が小さくても minH を維持）
- [ ] モーダルがスケール（ぽよん）に頼っていない（暗転＋輪郭強化で前に出す）
- [ ] 通知/トーストが右下SaaS配置になっていない（上寄せスタック）

#### 🟡 **IMPORTANT (強く推奨)**
- [ ] 余白が均一すぎない（8/14/24 の段差で情報の塊を作れている）
- [ ] “確定感” がある（短時間の枠点灯など。音頼みにしない）
- [ ] 入力が“フォーム”ではなく“道具”（凹み + 枠 + focus-visible）
- [ ] 日本語の崩れ（禁則/約物/括弧）と数字の揺れ（`tabular-nums`）に配慮している
- [ ] 重い blur / backdrop-filter / 大きいブラー影を乱用していない（特にモバイル）

### 4. Pixi.js 固有チェック (該当する場合)
- [ ] `destroy({ children: true })` でクリーンアップ実装
- [ ] `prefers-reduced-motion` 対応 (アニメーション抑制)
- [ ] duration/easing は tokens or 一貫したセットで運用（場当たりで増殖させない）
- [ ] usePixiHudLayer + usePixiLayerLayout パターン使用

### 5. 出力形式

変更されたファイルごとに以下の形式でレポート:

```markdown
## デザイン監査レポート: [ファイル名]

### ✅ 合格項目
- 余白: `pt:"19px", pb:"22px"` で非対称性確保
- 角丸: 主ボタン `3px`、副ボタン `7px` で差別化
- アニメーション: `cubic-bezier(.2,1,.3,1)` でカスタム

### ⚠️ 改善推奨
- **行間**: 全段落 `1.5` で統一 → 見出し `1.2`/本文 `1.5`/注釈 `1.7` に差別化推奨
- **ホバー**: 影のみ → `translateY(-1px)` 追加で物理感向上

### ❌ 要修正
- **影**: 全カード `boxShadow:"md"` で統一 → 面積に応じて `sm/md/lg` に分割必須
- **余白**: `p={4}` (16px) の4倍数 → `p:"19px"` など非均一値に変更必須

### 💡 具体的な修正案
[該当箇所のコード例を提示]
```

### 6. 判断基準
- **崩す** = 目的ある微差 (読みやすさ・階層・手触り向上)
- **雑** = 理由なく変える/再現性なし/品質が揺れる

変更理由を**言語化できるか**が境界線。

### 7. スコープ制御
- デフォルト: 変更ファイルのみ対象
- `--full` フラグ: プロジェクト全体を監査
- `--file [path]`: 特定ファイルのみ監査

## 注意事項
- レポートは簡潔に (ファイルあたり5-10項目程度)
- ロジックファイル (lib/hooks, lib/firebase等) はスキップ
- 既存コードの破壊的変更は提案しない (新規・修正のみ)

## プロジェクト固有ルール
- **ダークモード固定** (ライトテーマ関連は全て拒否)
- **2クリック導線維持** (UX を崩す変更は拒否)
- **Pixi背景統一** (CSS背景への戻しは拒否)
- **prefers-reduced-motion 尊重** 必須

## 参照
- `docs/UI_CORE_SPEC.md`（UI Core Spec / 唯一の正）
- `docs/ui_theme/hd2d_pack.md`（テーマ適用時のみ）
- `STYLE_GUIDE.md`（tokens-first）
- `theme/DESIGN_GUIDE.md`（Chakra v3 設計）
- `CLAUDE.md` (プロジェクト方針)
- 既存実装例: `components/ui/AppButton.tsx`, `components/settings/SettingsModal.tsx`
