# OPERATIONS ガイドライン

このドキュメントは「序の紋章 III（オンライン版）」を安定運用するための運用手順・監視ポイント・トラブルシュート方法をまとめたものです。新しいメンバーが参画した際はまずここを確認し、必要に応じて更新してください。

---

## 1. プロジェクト概要
- **技術スタック**: Next.js 14（App Router）/ TypeScript / Chakra UI / Pixi.js / GSAP / Firebase（Firestore + RTDB + Auth + Functions）/ Stripe
- **主要環境変数**  
  - `NEXT_PUBLIC_APP_VERSION`: ビルド識別子。Safe Update の差分判定にも利用。  
  - `NEXT_PUBLIC_ENABLE_PWA`: PWA / Service Worker を有効化。  
  - `NEXT_PUBLIC_FEATURE_SAFE_UPDATE`: Safe Update フローを有効化。  
  - `NEXT_PUBLIC_FSM_*`: （廃止済み）XState は常時有効なため不要。  
  - `NEXT_PUBLIC_PRESENCE_*`: RTDB プレゼンス調整用。  
- **基本コマンド**  
  - `npm run dev`: 開発サーバー  
  - `npm run build && npm run start`: 本番ビルドの検証  
  - `npm run typecheck`: 型検査  
  - `npm run test`: Jest テスト（Playwright は別途）  

---

## 2. レポジトリ構成と責務
- `app/`: Next.js App Router のルート。Service Worker 登録やレイアウトなども配置。  
- `components/`: UI コンポーネント。Pixi 関連、HUD、更新バナー等が含まれる。  
- `lib/`: ビジネスロジックやユーティリティ。`lib/serviceWorker/` に Safe Update 管理ロジックあり。  
- `hooks/` / `lib/hooks/`: カスタムフック。状態管理や Firebase 連携はこちらを利用。  
- `docs/`: 運用資料。新しい運用フローを追加したらここに追記する。  
- `functions/`: Firebase Functions。サービス層から直接アクセスせず `lib/game/service.ts` 経由で利用。  

---

## 3. デプロイ前チェックリスト
1. `.env.production` / Vercel 環境変数で必要なキーが揃っているか確認。  
   - `NEXT_PUBLIC_APP_VERSION` を更新済みか。  
   - `NEXT_PUBLIC_ENABLE_PWA=1` / `NEXT_PUBLIC_FEATURE_SAFE_UPDATE=1` が有効か。  
2. `npm run typecheck` と必要なテストを実行。影響範囲が大きい場合は Playwright 個別テストも走らせる。  
3. `npm run build` を実行し、ビルドエラーや lint 警告を確認。  
4. Service Worker のキャッシュ対象（`public/sw.js` の `CORE_ASSETS`）に変更がないか確認。追加アセットがある場合は忘れずに追記。  

---

## 4. デプロイフロー（Vercel 想定）
1. `main` ブランチに PR を作成し、CI が通過することを確認。  
2. マージ後、Vercel の自動デプロイを待つ。必要に応じて Preview 環境で動作確認。  
3. 本番反映後、Safe Update と Presence を必ず動作確認（手順は後述）。  
4. デプロイ結果・確認項目を Slack / Notion / docs に記録。  

---

## 5. 監視・テレメトリ
- **ブラウザ内メトリクス**: `window.__ITO_METRICS__` に主要メトリクスが格納される。  
  - `safeUpdate.*`: Safe Update の待機・適用・失敗回数。  
  - `sw.*`: Service Worker のループガード発動回数など。  
  - `participants.*`: Presence 状態の監視。  
- **Trace ログ**: 重要ユーザー操作は `traceAction` / `traceError` で記録。DevTools Console で `[trace:*]` をフィルターすると確認しやすい。  
- **Drop デバッグ**: `NEXT_PUBLIC_UI_DROP_DEBUG=1` を `.env.local` へ追加して再起動すると、以下が有効になる。
  1. `window.dumpBoardState()` … Console で実行すると現在の `proposal/pending/placeholder` 情報を JSON で取得できる。
  2. `traceAction("board.drop.attempt")` … ドロップ拒否時に `reasonIfRejected` と `targetSlot` を送出。
  3. `traceAction("board.slot.state")` … Ghost カードやプレースホルダが生成されたスロットをロギング。  
  収集手順: (a) DevTools を開き `window.dumpBoardState()` の出力をコピー、(b) Console の `[trace:board.*]` を保存、(c) `downloaded-logs` へ貼り付けて共有。

- **Sentry**: `lib/telemetry/` 経由で送信。Sentry DSN を設定した環境のみ有効。  

---

## 6. Safe Update 運用手順
Safe Update は 2025-10-25 時点でフローを再構築済み。最新仕様の検証と運用は以下の通り。

### 6.1 デプロイ後の確認
1. 旧バージョンが開いたままのタブで本番 URL を表示。  
2. `window.__ITO_METRICS__.safeUpdate` に `deferred` が 1 以上追加されること。  
3. `navigator.serviceWorker.getRegistration().then(r => !!r?.waiting)` が `true` になること。  
4. ミニドックの更新バッジまたは Safe Update バナーが表示されること。  
5. タブを非表示にする、あるいは DevTools の `Skip Waiting` を押すと 12 秒以内に自動リロードされること。  
6. 失敗シナリオ検証（任意）  
   - DevTools で一時的に Offline モードに切り替え、手動適用を押下 → `safe_update.failure` が記録され、ボタンが「再試行」に変わることを確認。  
   - オンラインに戻して再試行し、正常に適用されるか確認。  

### 6.2 監視ポイント
- `safe_update.suppressed` が増え続ける場合はループガードが働いている可能性あり。バナーに「自動更新を保留中」と表示されるためユーザーが手動適用できるが、連続発生時は原因調査が必要。  
- `safe_update.failure` が継続する場合は、キャッシュ破損やネットワーク制限を疑い、`docs/SAFE_UPDATE_TEST_PLAN.md` を参照して再現手順を踏む。  

### 6.3 手動復旧
- ハードリロードでも解消しない場合は以下の手順を案内する。  
1. DevTools > Application > Clear storage で「Unregister service workers」「Clear site data」を実行。  
  2. ブラウザを再起動して再アクセス。  
- 組織内での対応履歴は `docs/safe-update-incident-*.md` にまとめる。最新のメモは `docs/safe-update-incident-20251025.md`。  

---

## 7. Presence／リアルタイム同期の注意点
- Presence は RTDB が唯一のソース。Firestore の `lastSeen` は廃止方針。  
- `lib/hooks/useParticipants.ts` で `presenceReady` を確認してから人数判定を行う。  
- ホストの離脱検知は RTDB を用いるため、ネットワーク断線時の猶予 (`PRESENCE_STALE_MS`) を調整する際は本番値を基準に慎重に変更する。  

---

## 8. インシデント対応フロー
1. 発生時刻・影響範囲・再現条件を記録（スクリーンショットや Console ログも保存）。  
2. `docs/` 配下のインシデントテンプレートに追記。必要に応じて Slack / Notion で共有。  
3. 原因分析と暫定対応をまとめたら、再発防止策を ISSUE / ドキュメントに反映。  
4. 影響が Safe Update 絡みであれば `safe-update-incident-YYYYMMDD.md` を更新。  

---

## 9. 観戦フロー運用メモ
観戦UIと再入室フローは XState + `useSpectatorController` / `useSpectatorSession` で統合管理される。観戦チケット販売や大規模イベントに備えて、以下の点を確認する。

### 9.1 再入室フローの確認項目
1. ホストが待機状態のルームを開き、別ブラウザで観戦者として入室する。  
2. 観戦者が「席に戻る」を押すと `spectatorSessions/{sessionId}.rejoinRequest.status` が `pending` になること。  
3. Firestore の `spectatorSessions/{sessionId}` に `rejoinRequest.source` が `manual`/`auto` として記録されること。  
4. ホスト承認後、観戦者が即座にプレイヤーへ戻り、観戦パネルが消えること。  
5. DevTools Console のトレースに `spectator.request.intent` / `spectator.request.blocked.*` / `spectator.request.timeout` が出力されていること。  

### 9.2 便利なテストコマンド
- 単体テスト（観戦セッション）: `npm test -- useSpectatorSession`  
- Route Handler テスト: `npm test -- spectatorHostFlow.spec.ts`  
- Playwright 観戦シナリオ（個別実行）: `npx playwright test tests/spectatorHostFlow.spec.ts tests/spectatorSessionRoutes.spec.ts`  

### 9.3 トラブルシュートのヒント
- 観戦者が戻れない場合は `rooms/{roomId}/ui.recallOpen` が `false` になっていないか確認する。  
- 観戦パネルがプレイヤーに残る場合は `traceAction("spectator.mode")` の値が `isSpectatorMode=false` になっているかチェック。  
- 連続して再入室が失敗する際は、`spectatorSessions/{sessionId}.rejoinRequest` が `pending` のまま残っていないか、API `/api/spectator/sessions/*` のレスポンスコードを確認する。  

### 9.4 監視と上限の目安
- ゲート判定のトレース: `traceAction("spectator.gate")` で `spectatorCandidate` / `mustSpectateMidGame` を確認できる。  
- 自動呼び戻しの結果は `traceAction("spectator.autoRecall")` とメトリクス `spectator.autoRecall{Attempt,Success,Failure}` に記録。  
- 進行中直入りは強制観戦ルートで処理されるため、観戦UIが出ない場合は gate ログを確認。  
- 観戦者数の実運用目安: 身内向けは 8 人程度までならプレイヤー体感への影響は軽微。大量観戦（イベント時など）を検証する際は「サマリ購読」「観戦ライトUI」「presence 分離」を検討する。  

---

## 10. Quick Start（サーバー主導）運用メモ
ホストの「クイック開始」は Cloud Functions（Callable）`quickStart` が一括処理する。クライアントは Function を呼び出すだけで、以下がサーバー側で順番に実行される。

1. `rooms/{roomId}` の `status` が `waiting` であることを検証し、`hostId` と呼び出しユーザー UID が一致するか確認。  
2. `status: "clue"` へ遷移し、`result` / `deal` / `order` / `mvpVotes` を初期化、`ui.recallOpen` を `false` に設定。  
3. プレイヤードキュメントを一括でリセット（`number`/`clue1`/`ready`/`orderIndex`）。  
4. トピックを決定。`カスタム` 以外は `public/itoword.md` からカテゴリ別にランダム抽選（取得失敗時は `defaultTopics` へフォールバック）。  
5. Presence (RTDB) のオンライン情報を加味してプレイヤー順を確定し、番号を生成。  
6. `roomProposals/{roomId}` を初期化して提案キューを空にする。  

### 10.1 デプロイとエミュレータ
- 関数を更新したら `firebase deploy --only functions:quickStart` で反映する。  
- ローカル検証は `firebase emulators:start --only "functions,firestore,auth,database"` を推奨。`.env.local` で  
  `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true` および必要なら `NEXT_PUBLIC_FUNCTIONS_EMULATOR_HOST=localhost` / `NEXT_PUBLIC_FUNCTIONS_EMULATOR_PORT=5001` を設定する。  
- 本番接続時は `NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION` を設定する（例: `asia-northeast1`）。未設定の場合は `us-central1` が使われる。  

### 10.2 クライアント側メモ
- `lib/hooks/useHostActions.ts` が `httpsCallable("quickStart")` を利用するよう更新済み。`startGame` / `topicControls.dealNumbers` を直接呼ぶ実装は残さない。  
- カスタムお題サブミット (`handleSubmitCustom`) も同じ Function を使用する。  
- 成功時は `traceAction("ui.host.quickStart.result")`（通常）/`traceAction("ui.topic.customSubmit.quickStartResult")`（カスタム）で結果が記録されるので Console で確認できる。  

### 10.3 トラブルシュート
- 401/403 → 認証未完了またはホスト以外が呼んでいる。  
- `failed-precondition` → ルームが `waiting` 以外、カスタムお題が空、またはプレイヤー数が 0。  
- トピック取得に失敗した場合は警告を残しつつ `defaultTopics` へフォールバックする。継続的に発生する場合は `TOPIC_SOURCE_URL` を確認。  

---

## 11. よく使うコマンド／スクリプト
- **Playwright 個別実行**: `npx playwright test tests/roomMachine.spec.ts`  
- **Firestore ルールのデプロイ**: `firebase deploy --only firestore:rules`  
- **Functions ローカルテスト**: `npm --prefix functions run lint && npm --prefix functions test`  
- **パフォーマンス計測（Pixi）**: `npm run dev` 起動後、`docs/performance-report.md` の手順に従う。  

---

## 12. ドキュメント更新の運用
- 仕様や運用手順を変更した場合は、PR の一部として `docs/` 以下も更新する。  
- `AGENTS.md`, `CLAUDE.md`, `docs/SAFE_UPDATE_TEST_PLAN.md` などロール別ハンドブックとの整合を保つ。  
- 重大な更新を行ったときは `CHANGELOG.md`（未整備の場合は新規作成）やチーム内共有ツールで告知する。  

---

## 13. Firestore セッションガード / Permission-Denied 対策

2025-11-15 以降、以下の仕組みで Firestore の権限切れを自動復旧します。運用時はこの節を参照してください。

1. **AuthSessionHeartbeat**（`components/AuthSessionHeartbeat.tsx`）が 18 分ごと + タブ復帰時に `ensureAuthSession` を実行し、ID トークンを事前更新します。
2. **Permission Guard**（`lib/firebase/permissionGuard.ts`）を `lib/game/service.ts` などのサービス関数に適用し、`permission-denied` を検知したら
   - 「接続を再確認しています…」トーストを表示
   - `ensureAuthSession()` で匿名セッションを再確立
   - 同じ処理を 1 回だけ自動リトライします。
   - それでも失敗した場合は「ページを再読み込みしてください」と赤色トーストで案内されます。
3. **ルーム購読（`lib/hooks/useRoomState.ts`）** も同じトースト ID を使って状況を通知します。トーストが出続ける場合は `traceError("firestore.permissionDenied", …)` をフィルターし、Auth / ルール / App Check の設定を確認してください。

### 13.1 運用時のチェックリスト
- 「接続を再確認しています…」トーストが出たときは 5 秒程度様子を見る。自動で「接続を再開しました」に切り替われば問題なし。
- 連続で `firestore.permissionDenied` が出る場合は Firebase Auth で匿名ログインが禁止されていないか確認し、必要に応じて `firebase auth:signOut` や再デプロイでトークンを更新する。
- QA では「タブを 1 時間以上放置 → ゲーム開始/カード提出」を試し、自動再認証が走るかを確認する。
- 監視用メトリクス: `traceError` の `firestore.permissionDenied.*` / `window.__ITO_METRICS__.background.lastInitMs`（リセット後の描画確認）。

最終更新日: 2025-11-15  
編集者: Codex（GPT-5 ベース）
