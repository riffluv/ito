# Codex Agent ガイド

このリポジトリで Codex (Coding CLI) が作業するときに把握しておきたいポイントをまとめています。実装・修正タスクを受け取ったら、まずここをざっと確認してください。

---

## 1. プロジェクト概要と現状

- タイトル: **序の紋章 III（オンライン版）**
- ゲーム内容: 「ito」ライクな協力推理ゲーム。ブラウザ上で数字カードを推理・並べ替えて遊ぶ。
- 技術スタック: Next.js 14 App Router / TypeScript / Chakra UI / Pixi.js 8 / GSAP 3 / Firebase (Firestore + RTDB + Auth + Functions) / Stripe
- 現行ブランチでは **FSM（XState）実装** が feature flag 付きで導入済み。`NEXT_PUBLIC_FSM_ENABLE=1` で新実装が動作。
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

---

## 4. 状態管理まわりのポイント

### Feature Flag: FSM

- `.env.local` に `NEXT_PUBLIC_FSM_ENABLE` を追加することで、新旧ロジックを切り替えられる。
- `1`: `lib/state/roomMachine.ts` の XState ベース状態機械を利用。`useRoomState` が machine を interpret し、イベントで進行。
- `0` または未設定: 旧ロジック（手書きステート管理）を使用。
- FSM 有効時は `roomStatus` だけでなく `phase`・`sendRoomEvent` が expose されるので、UI 側の条件分岐に注意。

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

## 7. 今後の推奨フロー（FSM を前提にする場合）

1. `.env.local` に `NEXT_PUBLIC_FSM_ENABLE=1` を設定して動作確認。
2. 問題なければフラグ分岐を削除し、新しい状態機械に完全移行。
3. 移行後は不要になった旧ロジック／ユーティリティを整理していく。

---

## 8. 連絡・共有

- 変更点・気づき・トラブルシュート結果は `docs/OPERATIONS.md` か専用ナレッジ（Notion/GitHub Discussions 等）へ追記。
- 他エージェント（Claude など）と協業する場合は、トレース名やフラグの状態を明記して連携する。

以上。作業前にこのドキュメントをざっと確認し、タスクに取りかかってください。必要があれば自由に追記・修正して構いません。*** End Patch
