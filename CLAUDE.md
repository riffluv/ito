# Claude Code ガイド

このドキュメントは、Claude Code（デザインレビューやライトな実装サポート担当）がこのリポジトリで作業する際のハンドブックです。UI/UX の観点と軽量な実装提案にフォーカスしています。

---

## 1. プロジェクト概要

- タイトル: **序の紋章 III（オンライン版）**
- ジャンル: ブラウザで遊べる「ito」系協力推理ゲーム（HD-2D / ドラクエ風 UI）
- 技術スタック: Next.js 14 / TypeScript / Chakra UI v3 / Pixi.js 8 / GSAP 3 / Firebase (Firestore + RTDB + Auth + Functions) / Stripe
- Presence は RTDB が単独のソース。`.env.local` に `NEXT_PUBLIC_DISABLE_FS_FALLBACK=1` を設定済み。
- FSM (XState) 実装が feature flag (`NEXT_PUBLIC_FSM_ENABLE`) で導入済み。現在は 1 にして動作確認中。

---

## 2. Claude が着目すべき領域

1. **UI/UX 全体設計**  
   - Chakra UI コンポーネント (`components/ui/*`) と Pixi HUD (`components/pixi/*`, `lib/showtime/*`) の整合性
   - prefers-reduced-motion、DPI スケーリング (`scaleForDpi`) への配慮

2. **演出とアニメーション**  
   - `components/ui/GameCard.tsx`、`components/ui/GameResultOverlay.tsx` など GSAP を利用した演出
   - Pixi レイヤー (`lib/showtime/`) の重複タイマーや cleanup を確認

3. **テレメトリとトレース**  
   - `lib/utils/trace.ts` により `traceAction` / `traceError` が導入済み。追加する際は名称粒度を揃える
   - Safe Update 系 (`lib/telemetry/safeUpdate.ts`) のイベント名一貫性を維持

4. **アクセシビリティ & ショートカット**  
   - `useClueInput` のショートカット (`Space` / `Enter`) や `BoardArea` のロール属性など
   - `prefers-reduced-motion` 時の Pixi/GSAP fallback を確認

---

## 3. ドキュメントと情報源

| 目的 | ファイル |
| ---- | -------- |
| 全体の運用・トラブルシュート | `docs/OPERATIONS.md` |
| ゲームロジック概要 | `docs/GAME_LOGIC_OVERVIEW.md` |
| Pixi / HUD 仕様メモ | `docs/performance-report.md`, `docs/perf-metrics-dashboard.md` など |
| Codex 向け作業ガイド | `AGENTS.md` |

必要に応じて `docs/` 配下を検索し、関連資料を参照してください。

---

## 4. デザイン／実装レビュー時のチェックリスト

- [ ] **レスポンシブ対応**: `UNIFIED_LAYOUT` での breakpoints、DPI 125% / 150% の挙動を確認
- [ ] **reduced-motion**: アニメーションが適切に無効化／簡略化されるか (`useReducedMotionPreference`)
- [ ] **トレース**: 新規アクションを追加した場合は `traceAction`／`traceError` が仕込まれているか
- [ ] **Pixi cleanup**: Pixi オブジェクト生成時に destroy/cleanup が実装されているか
- [ ] **Firestore 書き込み**: UI から直接書き込んでいないか（`lib/game/service.ts` を経由しているか）
- [ ] **ショートカット**: `useClueInput` などのキーボード操作が意図どおり機能＆テストされているか
- [ ] **カード演出**: 反転アニメの duration（通常 0.62s / result 0.4s）が意図と合っているか。初回表示でカードが消えないか
- [ ] **Presence**: `presenceReady` を待たずに人数判定していないか
- [ ] **Safe Update**: Service Worker 更新経路で telemetry が欠けていないか

---

## 5. 実行コマンド（参考）

```bash
npm run dev          # 開発サーバー
npm run build        # 本番ビルド
npm run typecheck    # 型チェック
npm run test         # Jest (単体テスト)
npx playwright test  # Playwright（必要なファイルのみ指定して実行）
```

デザイン検証時は `npm run build && npm run start` で本番ビルドの挙動を観察すると体感が安定します。

### 開発環境の注意点（重要）

- **React Strict Mode は無効化済み** (`next.config.mjs` で `reactStrictMode: false`)
- **理由**: Pixi.js / GSAP の2重初期化により、開発環境（`npm run dev`）でカード描画不具合が発生
  - カードがチカチカする
  - カードが表示されない
  - 連想ワード入力後にカードが空きスロットに出せない
  - アニメーションが途中で止まる
- **本番環境への影響**: なし
  - `npm run start` (本番ビルド) では元々 Strict Mode の2重レンダリングは発生しない
  - Vercel デプロイも同様に影響なし
  - この設定変更はデプロイしても完全に安全
- **推奨開発フロー**:
  - 通常開発: `npm run dev` で快適に作業
  - 品質確認: `npm run start` で本番ビルドをテスト

---

## 6. FSM フラグについて

- `.env.local` の `NEXT_PUBLIC_FSM_ENABLE=1` で状態機械（`lib/state/roomMachine.ts`）を有効化。
- 有効時でも UI 挙動は既存と同じになるよう設計済み。トラブルがあれば値を `0` に戻して旧ロジックに切り替え可能。
- 安定確認後はフラグ分岐を削る予定。レビュー時は両モードでの差分がないか留意する。

---

## 7. 提案・修正時の注意事項

1. **軽量な実装のみ対応**  
   複雑なリファクタや大規模変更は Codex (Coding Agent) に任せる。Claude 側ではデザインフィードバックや軽微な調整を中心に。

2. **diff を意識した提案**  
   小さい変更でも意図をコメントに残す。必要に応じて `traceAction` 名やアニメーション時間の理由を書き添える。

3. **テスト確認**  
   DOM／アニメーション変更後は最低限 `npm run typecheck`、必要なら対象の Playwright テストを指定実行。

4. **ログ／メトリクスの監視**  
   `window.__ITO_METRICS__` やブラウザ console `[trace:action]` を確認し、レポートへ反映。

---

## 8. よくある相談と回答例

- **カード提出ボタンが反応しない** → `traceAction("ui.card.submit")` が出ているか・`computeAllSubmitted` の条件が揃っているか確認。Presence Ready かどうかもチェック。
- **判定ボタン押下でカードが消える** → `components/CentralCardBoard.tsx` の `activeProposal` フォールバックを参照。
- **アニメーションが速すぎる／遅すぎる** → `components/ui/GameCard.tsx` の duration 定数を調整し、体感を再確認。
- **レイアウトが DPI125% で崩れる** → `UNIFIED_LAYOUT` の DPI 設定に漏れがないか、`scaleForDpi()` の適用箇所を再確認。

---

## 9. 更新履歴メモ

- 2025-10：FSM 実装を feature flag 付きで導入。カード消失バグ（提出 → reveal）のフォールバックを追加。カード回転アニメの時間を調整。
- 2025-10：`docs/OPERATIONS.md` を新設し、運用/テレメトリ/トラブルシュートを整理。

必要に応じてこのドキュメントに追記し、Claude と Codex 双方が同じ状況を把握できるようにしてください。*** End Patch
