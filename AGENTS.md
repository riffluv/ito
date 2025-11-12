# Codex Agent ガイド

このリポジトリで Codex (Coding CLI) が作業するときに把握しておきたいポイントをまとめています。実装・修正タスクを受け取ったら、まずここをざっと確認してください。

---

## 1. プロジェクト概要と現状

- タイトル: **序の紋章 III（オンライン版）**
- ゲーム内容: 「ito」ライクな協力推理ゲーム。ブラウザ上で数字カードを推理・並べ替えて遊ぶ。
- 技術スタック: Next.js 14 App Router / TypeScript / Chakra UI / Pixi.js 8 / GSAP 3 / Firebase (Firestore + RTDB + Auth + Functions) / Stripe
- 現行ブランチでは **FSM（XState）実装** が常時有効。旧ロジックへ戻すフラグは撤廃済み。
- Presence は Firestore の `lastSeen` ではなく **RTDB を唯一のソース** とする設計。

---

## 2. 主要ドキュメント

| 種別 | ファイル |
| ---- | -------- |
| ゲームロジック概要 | `docs/GAME_LOGIC_OVERVIEW.md` |
| 運用ガイド／トラブルシュート | `docs/OPERATIONS.md` |
| Pixi/PWA まわりの分析 | `docs/performance-report.md` など `docs/` 配下 |
| Claude 用ハンドブック | `CLAUDE.md` |

必要に応じて `docs/` ディレクトリ全体を検索し、関連資料を見つけてください。

---

## 3. 実行コマンド（ローカル）

```bash
npm run dev          # 開発サーバー
npm run build        # 本番ビルド
npm run start        # 本番ビルドの起動
npm run typecheck    # tsc --noEmit
npm run test         # Jest テスト（Playwright は別）
npx playwright test  # Playwright（個別指定推奨）
```

主な Playwright テスト: `tests/roomMachine.spec.ts`, `tests/submit-offline-continue.spec.ts`, `tests/clue-input-shortcuts.spec.ts`, 既存 `tests/presence-host.spec.ts` など。

### 🚨 開発環境の重要な設定（必読）

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

### Pixi 背景 / HUD 分離アーキテクチャ（2025-xx刷新）

- 背景は常に `ThreeBackground` が管理する専用 `<canvas>`（OffscreenCanvas サーフェス相当）に描画し、DOM の最背面に固定配置します。`PixiHudStage` は HUD レイヤー専用になり `mix-blend-mode: normal` で DOM を覆わないため、カードやボタンの色が濁りません。
- 古い `NEXT_PUBLIC_PIXI_BACKGROUND_SHARED` フラグは無効化済みで、共有レンダラーへのフォールバックは存在しません。`.env*` から消し忘れていても挙動には影響しません。
- 背景の初期化シーケンスは `createBackgroundHoldController` を通じて `PixiHudStage.holdBackground()` と同期しており、背景が描画可能になるまでプレースホルダーのグラデだけが表示されます。`window.bg.getRenderer()` は `pixi` / `dom` のどちらで描画しているかを示す唯一の真実です。
- `webglcontextlost`・`resize`・`visibilitychange` を `ThreeBackground` が直接監視し、必要なときだけ背景を再起動します。HUD の Pixi Application は巻き込まれないので、暗転調査のためにステージ全体を再起動する必要はありません。手動デバッグ時は DevTools から `document.dispatchEvent(new Event("visibilitychange"))` で再描画を誘発できます。
- 追加の Pixi 背景エフェクトを実装する場合も **`PixiHudStage` の `app` や `Container` を直接触らず**、`ThreeBackground` 経由で専用 canvas / controller を生成してください。HUD レイヤーと混在させたい場合は `usePixiHudLayer` を使って別 canvas 上で描画すること。

---

## 4. 状態管理まわりのポイント

### FSM 状態機械

- `lib/state/roomMachine.ts` (XState) が常時有効です。`useRoomState` が machine を interpret し、イベントで進行します。
- 以前の `NEXT_PUBLIC_FSM_ENABLE` フラグは撤廃済みです。
- FSM では `roomStatus` だけでなく `phase`・`sendRoomEvent` が expose されるので、UI 側の条件分岐に注意。

### トレース（trace）

- `lib/utils/trace.ts` の `traceAction` / `traceError` を経由し、主要操作を記録。
- サービス層 (`lib/game/service.ts`)・カード提出 (`lib/hooks/useCardSubmission.ts`)・ホスト操作 (`lib/hooks/useHostActions.ts` / `components/hooks/useHostActions.ts`)・ホスト委譲 (`components/ui/DragonQuestParty.tsx`) などに仕込み済み。
- 追加の重要処理を実装する際は、成功／失敗のタイミングで trace を入れることを検討する。

---

## 5. コーディング方針・注意点

1. **Firestore / RTDB への書き込みは必ず `lib/game/service.ts` 経由**  
   UI から直接 Firestore を呼ばない。新規メソッドを追加する場合も service を拡張する。

2. **Presence は RTDB のみを信頼**  
   旧 `lastSeen` へ戻すような変更は避ける。`useParticipants` の `presenceReady` を待ってから人数判定を行う。

3. **Pixi / GSAP の後片付け**  
   Pixi オブジェクトを生成する場合は destroy/cleanup を忘れずに。reduced-motion 対応も守る。

4. **ショートカット挙動のテスト**  
   `useClueInput` など、キーボード操作はユーティリティ関数化して Playwright/Jest で検証できる構造を保つ。

5. **サービスワーカー / Safe Update**  
   `lib/telemetry/safeUpdate.ts` を壊さないように。更新周りを触る場合は telemetry の送出を確認する。

6. **レイアウトと DPI**  
   `UNIFIED_LAYOUT` や `scaleForDpi()` の既定値を尊重し、マジックナンバーを避ける。

7. **トレース付きのエラー処理**  
   新規 API 呼び出しでエラーを拾うときは `traceError` を併用し、Sentry 側で調査できるようにする。

8. **テストを適宜実行**  
   変更範囲が限定的でも `npm run typecheck` を基本に、必要に応じて Jest / Playwright を走らせてから PR をまとめる。

---

## 6. よくある落とし穴

- **カード提出 → 「せーの！」直後の描画**  
  `activeProposal` の計算で `orderList` をフォールバックする実装が入っている（`components/CentralCardBoard.tsx`）。このロジックを崩すとカードが一瞬消えるので注意。
- **手動フリップ時のアニメーション**  
  `components/ui/GameCard.tsx` で duration を調整済み（通常 0.62s / result 0.4s）。変更する場合はユーザー体感を確認。
- **Presence Ready 前に人数判定**  
  `calculateEffectiveActive` を使う。`presenceReady` が false の間は Firestore fallback しない設計。
- **Playwright 全体実行**  
  既存の Jest テストが Playwright と混在しているため、個別ファイル実行で必要なものだけ走らせる方が速い。

---

## 7. 今後の推奨フロー（FSM 前提）

1. FSM は常時オンなので、XState 前提で実装・テストする。
2. 旧ロジックに依存したユーティリティを見つけたら削除・整理する。
3. テストやドキュメントも FSM 前提の内容に統一する。

---

## 8. 連絡・共有

- 変更点・気づき・トラブルシュート結果は `docs/OPERATIONS.md` か専用ナレッジ（Notion/GitHub Discussions 等）へ追記。
- 他エージェント（Claude など）と協業する場合は、トレース名やフラグの状態を明記して連携する。

---

## 9. 据え置き体感フラグ運用メモ

- `.env` 系で管理している据え置き関連フラグ（`NEXT_PUBLIC_PERF_INTERACTION_TAGS` / `NEXT_PUBLIC_PERF_ROOM_SNAPSHOT_DEFER` / `NEXT_PUBLIC_AUDIO_RESUME_ON_POINTER` / `NEXT_PUBLIC_UI_DROP_OPTIMISTIC`）は、検証が完了したら本番環境でも `1` にして常時有効化する想定。
- 本番で有効化後は、`dumpItoMetrics()` などでメトリクスをモニタリングし、数値に問題がなければ旧挙動用の分岐・フォールバックコードを順次削除・リファクタリングしておくことが推奨。
以上。作業前にこのドキュメントをざっと確認し、タスクに取りかかってください。必要があれば自由に追記・修正して構いません。*** End Patch

---

## 10. サーバー主導（Server-Authoritative）ポリシー（重要）

- 待機戻し（waiting reset）と `ui.recallOpen` の決定は、常にサーバー API を正規ルートとする。
  - 正規 API: `app/api/rooms/[roomId]/reset/route.ts`
  - ルーム更新は `composeWaitingResetPayload()` を唯一の真実として用いる（`lib/server/roomActions.ts`）。
- クライアントは Firestore に直接 `status` や `ui.recallOpen` を書かない。
  - 例外: ネットワーク断・認証不可時のみ、既存の安全なトランザクション・フォールバックを発火（ログに `traceAction("resetRoomWithPrune.fallback")`）。
- ホスト権限/観戦復帰などの“決定処理”は API/Functions に集約。
  - 例: ホストクレーム `app/api/rooms/[roomId]/claim-host/route.ts`
  - Functions 側の自動処理は補助であり、正規経路は API である旨をコメントで明示済み。
- Presence は RTDB を唯一のソースとし、人数・入席可否の判定は `presenceReady` 待ちを徹底。
- UI は“処理中”の体感を優先してよいが、状態の確定はサーバー応答に従う。
  - 実装例: リセット押下直後に `notify("待機状態に戻しています…")` を表示し、応答後に success/rollback。
