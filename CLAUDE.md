# Claude Code ガイド

このドキュメントは、Claude Code（デザインレビューやライトな実装サポート担当）がこのリポジトリで作業する際のハンドブックです。UI/UX の観点と軽量な実装提案にフォーカスしています。

---

## 1. プロジェクト概要

- タイトル: **序の紋章 III（オンライン版）**
- ジャンル: ブラウザで遊べる「ito」系協力推理ゲーム（HD-2D / ドラクエ風 UI）
- 技術スタック: Next.js 14 App Router / TypeScript / Chakra UI v3 / Pixi.js 8 / GSAP 3 / Firebase (Firestore + RTDB + Auth + Functions) / Stripe
- Presence は RTDB が単独のソース。`.env.local` に `NEXT_PUBLIC_DISABLE_FS_FALLBACK=1` を設定済み。
- FSM (XState) 実装は常時有効化済み。旧ロジックへ戻す feature flag (`NEXT_PUBLIC_FSM_ENABLE`) は撤廃済み。

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

## 4. 実行コマンド（参考）

```bash
npm run dev          # 開発サーバー
npm run build        # 本番ビルド
npm run start        # 本番ビルドの起動
npm run typecheck    # tsc --noEmit
npm run test         # Jest テスト（Playwright は別）
npx playwright test  # Playwright（個別指定推奨）
```

デザイン検証時は `npm run build && npm run start` で本番ビルドの挙動を観察すると体感が安定します。

### 開発環境の注意点（重要）

**React Strict Mode を無効化済み**（`next.config.mjs` で `reactStrictMode: false`）

#### 無効化した理由
Pixi.js / GSAP を使用した重量級アニメーションプロジェクトでは、Strict Mode の2重レンダリングが以下の問題を引き起こす：
- **Pixi.js スプライト**: 2重初期化によるメモリリーク・描画バグ
- **GSAP アニメーション**: タイムライン衝突・途中停止
- **カード描画**: チカチカ・表示されない・提出できない
- **Firestore 永続キャッシュ**: IndexedDB 同期エラー

#### 本番環境への影響
**完全にゼロ。デプロイしても安全。**
- `reactStrictMode` は開発時のデバッグツールで、本番ビルドには影響しない
- `npm run start` でも Vercel でも、Strict Mode の2重レンダリングは元々発生しない
- この設定変更は `npm run dev` の挙動のみに影響

#### 推奨開発フロー
- 通常開発: `npm run dev` で快適に作業
- 品質確認: `npm run start` で本番ビルドをテスト（Strict Mode 有効時と同じ挙動）

#### トラブルシュート
`npm run dev` でカード関連の不具合（チカチカ、表示されない、提出できない）が発生した場合：
1. `next.config.mjs` の `reactStrictMode` が `false` になっているか確認
2. 開発サーバーを再起動（Ctrl+C → `npm run dev`）
3. ブラウザのキャッシュをクリア（F12 → Application → Clear storage）

---

## 5. Pixi 背景 / HUD 分離アーキテクチャ

- 背景は常に `ThreeBackground`（実体は `PixiBackground`）が管理する専用 `<canvas>`（OffscreenCanvas サーフェス相当）に描画し、DOM の最背面に固定配置。
- `PixiHudStage` は HUD レイヤー専用になり `mix-blend-mode: normal` で DOM を覆わないため、カードやボタンの色が濁らない。
- 古い `NEXT_PUBLIC_PIXI_BACKGROUND_SHARED` フラグは無効化済み。共有レンダラーへのフォールバックは存在しない。
- 背景の初期化シーケンスは `ThreeBackground` / `PixiBackground` 内部の controller で制御され、背景が描画可能になるまでプレースホルダーのグラデだけが表示される。
- `webglcontextlost`・`resize`・`visibilitychange` を `ThreeBackground` が直接監視し、必要なときだけ背景を再起動。HUD の Pixi Application は巻き込まれない。
- 追加の Pixi 背景エフェクトを実装する場合も **`PixiHudStage` の `app` や `Container` を直接触らず**、`ThreeBackground` 経由で専用 canvas / controller を生成すること。

---

## 6. FSM 状態機械について

- XState ベースの状態機械（`lib/state/roomMachine.ts`）は常時有効。
- `NEXT_PUBLIC_FSM_ENABLE` フラグは削除済みのため、旧ロジックへ切り替える手段は不要。
- FSM では `roomStatus` だけでなく `phase`・`sendRoomEvent` が expose されるので、UI 側の条件分岐に注意。
- レビュー時は FSM 前提の実装／テストで問題ないかを確認。

---

## 7. デザイン／実装レビュー時のチェックリスト

- [ ] **レスポンシブ対応**: `UNIFIED_LAYOUT` での breakpoints、DPI 125% / 150% の挙動を確認
- [ ] **reduced-motion**: アニメーションが適切に無効化／簡略化されるか (`useReducedMotionPreference`)
- [ ] **トレース**: 新規アクションを追加した場合は `traceAction`／`traceError` が仕込まれているか
- [ ] **Pixi cleanup**: Pixi オブジェクト生成時に destroy/cleanup が実装されているか
- [ ] **Firestore 書き込み**: UI から直接書き込んでいないか（`lib/game/service.ts` を経由しているか）
- [ ] **ショートカット**: `useClueInput` などのキーボード操作が意図どおり機能＆テストされているか
- [ ] **カード演出**: 反転アニメの duration（通常 0.62s / result 0.4s）が意図と合っているか。初回表示でカードが消えないか
- [ ] **Presence**: `presenceReady` を待たずに人数判定していないか
- [ ] **Safe Update**: Service Worker 更新経路で telemetry が欠けていないか
- [ ] **背景/HUD 分離**: `PixiHudStage` と `ThreeBackground` を混在させていないか

---

## 8. コーディング方針・注意点（Guardrails）

1. **層を崩さない**
   ドメイン計算は `lib/game/domain.ts`、I/O は `room.ts`/services、UI は hooks/components。新ロジックはまず純粋関数を domain に足してから呼び出す。

2. **Firestore / RTDB への書き込みは必ず `lib/game/service.ts` 経由**
   UI から直接 Firestore を呼ばない。新規メソッドを追加する場合も service を拡張する。

3. **Presence は RTDB のみを信頼**
   旧 `lastSeen` へ戻すような変更は避ける。`useParticipants` の `presenceReady` を待ってから人数判定を行う。

4. **Pixi / GSAP の後片付け**
   Pixi オブジェクトを生成する場合は destroy/cleanup を忘れずに。reduced-motion 対応も守る。

5. **トレース付きのエラー処理**
   新規 API 呼び出しでエラーを拾うときは `traceError` を併用し、Sentry 側で調査できるようにする。

6. **テスト必須**
   変更範囲が限定的でも `npm run typecheck` を基本に、新しいドメイン関数には Jest を1本追加。

---

## 9. サーバー主導（Server-Authoritative）ポリシー（重要）

- 待機戻し（waiting reset）と `ui.recallOpen` の決定は、常にサーバー API を正規ルートとする。
  - 正規 API: `app/api/rooms/[roomId]/reset/route.ts`
  - ルーム更新は `composeWaitingResetPayload()` を唯一の真実として用いる（`lib/server/roomActions.ts`）。
- クライアントは Firestore に直接 `status` や `ui.recallOpen` を書かない。
  - 例外: ネットワーク断・認証不可時のみ、既存の安全なトランザクション・フォールバックを発火。
- ホスト権限/観戦復帰などの"決定処理"は API/Functions に集約。
- Presence は RTDB を唯一のソースとし、人数・入席可否の判定は `presenceReady` 待ちを徹底。
- UI は"処理中"の体感を優先してよいが、状態の確定はサーバー応答に従う。

---

## 10. よくある相談と回答例

- **カード提出ボタンが反応しない** → `traceAction("ui.card.submit")` が出ているか・`computeAllSubmitted` の条件が揃っているか確認。Presence Ready かどうかもチェック。
- **判定ボタン押下でカードが消える** → `components/CentralCardBoard.tsx` の `activeProposal` フォールバックを参照。
- **アニメーションが速すぎる／遅すぎる** → `components/ui/GameCard.tsx` の duration 定数を調整し、体感を再確認。
- **レイアウトが DPI125% で崩れる** → `UNIFIED_LAYOUT` の DPI 設定に漏れがないか、`scaleForDpi()` の適用箇所を再確認。
- **Presence Ready 前に人数判定** → `calculateEffectiveActive` を使う。`presenceReady` が false の間は Firestore fallback しない設計。
- **Playwright 全体実行が遅い** → Jest と混在しているため、個別ファイル実行で必要なものだけ走らせる方が速い。

---

## 11. Context7 運用メモ

- 主要ライブラリ（Next.js / React / XState / Firebase / Stripe / Pixi.js / GSAP / Chakra UI など）を触るときは、Context7 で該当ライブラリのドキュメントを確認することを推奨。
- 破壊的変更や挙動差分が出やすい箇所（状態機械 `lib/state/roomMachine.ts`、Firestore/RTDB/Functions、Pixi 背景・HUD、決済まわり）は、Context7 で現在の利用バージョン付近のドキュメントをチェックする。
- 仕様が曖昧なときや挙動に不安があるときは「Context7 で該当ライブラリの情報を確認してから実装して」と明示的に指示してよい。

---

## 12. 提案・修正時の注意事項

1. **軽量な実装のみ対応**
   複雑なリファクタや大規模変更は Codex (Coding Agent) に任せる。Claude 側ではデザインフィードバックや軽微な調整を中心に。

2. **diff を意識した提案**
   小さい変更でも意図をコメントに残す。必要に応じて `traceAction` 名やアニメーション時間の理由を書き添える。

3. **テスト確認**
   DOM／アニメーション変更後は最低限 `npm run typecheck`、必要なら対象の Playwright テストを指定実行。

4. **ログ／メトリクスの監視**
   `window.__ITO_METRICS__` やブラウザ console `[trace:action]` を確認し、レポートへ反映。

---

## 13. 据え置き体感フラグ運用メモ

- `.env` 系で管理している据え置き関連フラグ（`NEXT_PUBLIC_PERF_INTERACTION_TAGS` / `NEXT_PUBLIC_PERF_ROOM_SNAPSHOT_DEFER` / `NEXT_PUBLIC_AUDIO_RESUME_ON_POINTER` / `NEXT_PUBLIC_UI_DROP_OPTIMISTIC`）は、検証が完了したら本番環境でも `1` にして常時有効化する想定。
- 本番で有効化後は、`dumpItoMetrics()` などでメトリクスをモニタリングし、数値に問題がなければ旧挙動用の分岐・フォールバックコードを順次削除・リファクタリングしておくことが推奨。

---

## 14. 連絡・共有

- 変更点・気づき・トラブルシュート結果は `docs/OPERATIONS.md` か専用ナレッジ（Notion/GitHub Discussions 等）へ追記。
- 他エージェント（Codex など）と協業する場合は、トレース名やフラグの状態を明記して連携する。

---

## 15. 更新履歴メモ

- 2025-12: AGENTS.md と同期し、Pixi 背景/HUD 分離アーキテクチャ、Guardrails、Context7 運用メモなどを追加。
- 2025-10: FSM 実装を feature flag 付きで導入。カード消失バグ（提出 → reveal）のフォールバックを追加。カード回転アニメの時間を調整。
- 2025-10: `docs/OPERATIONS.md` を新設し、運用/テレメトリ/トラブルシュートを整理。

必要に応じてこのドキュメントに追記し、Claude と Codex 双方が同じ状況を把握できるようにしてください。
