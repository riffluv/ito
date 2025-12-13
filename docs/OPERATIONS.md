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
- **ルーム書き込みの経路**: `rooms`/`players` への永続更新は Next.js API (`app/api/rooms/*` → `lib/services/roomApiClient`) を正規ルートとする。UI からの Firestore 直書きは禁止（Presence は RTDB のみ）。  
- ゲーム進行系（配札・提案配列 add/move/remove・カード確定・リザルト待ち復帰）は `/api/rooms/[roomId]/deal` `/proposal` `/commit-play` `/continue` 経由に統一済み。ドラッグ中の処理はローカルのみで、確定タイミングだけ API を叩く。  
- お題操作（カテゴリ選択/シャッフル/カスタム/リセット）・MVP 投票・UI フラグ（`ui.revealPending` / `ui.roundPreparing`）・プレイヤープロフィール/状態リセットも API ルートへ移行済み。クライアントの Firestore 直書きは全撤廃し、必要な場合のみサーバー側コマンドを追加する。  
- 例外: `/api/rooms/{id}/leave` が失敗したときだけ実行される非常用フォールバック（`lib/firebase/rooms.ts` 内のトランザクション）が残存。通常は API のみ。  

---

## 3. デプロイ前チェックリスト
1. `.env.production` / Vercel 環境変数で必要なキーが揃っているか確認。  
   - `NEXT_PUBLIC_APP_VERSION` を更新済みか。  
   - `NEXT_PUBLIC_ENABLE_PWA=1` / `NEXT_PUBLIC_FEATURE_SAFE_UPDATE=1` が有効か。  
2. `npm run lint -- --max-warnings=0` と `npm run typecheck` を必ず実行。  
3. 進行/ホスト系の変更が入った場合は最低限以下を個別実行して“ゴールデンパス”を守る。  
   - `npx playwright test tests/roomMachine.spec.ts tests/hostActions.nextRound.spec.ts tests/hostActions.preparing.spec.ts`  
4. `npm run build` を実行し、ビルドエラーや lint 警告を確認。  
5. Service Worker のキャッシュ対象（`public/sw.js` の `CORE_ASSETS`）に変更がないか確認。追加アセットがある場合は忘れずに追記。  

---

## 4. デプロイフロー（Vercel 想定）
1. `main` ブランチに PR を作成し、CI が通過することを確認。  
2. マージ後、Vercel の自動デプロイを待つ。必要に応じて Preview 環境で動作確認。  
3. 本番反映後、Safe Update と Presence を必ず動作確認（手順は後述）。  
4. デプロイ結果・確認項目を Slack / Notion / docs に記録。  

### 4.1 Vercel Build/Output 設定（API 破壊防止）
- Build Command は `npm run build`（Next.js プリセット）に固定する。`next build && next export` や `output: export` 相当の設定を入れない。  
- Output Directory は空欄のままにし、`out` を指定しない。Static Site 判定になると `/api/*` が 405/500 になりゲームが起動しなくなる。  
- Framework プリセットは「Next.js」を選択する（Static Site / Other にしない）。  
- Production Overrides（黄色い帯が出るセクション）が有効だと Project Settings を上書きして Static Site になる場合がある。Overrides はすべて OFF にし、Build Command / Output Directory が Project と一致しているか確認する。  
- デプロイ詳細画面で Build Logs を開き、「Static Export」「output: export」「.vercel/output/static」などが出ていないか確認する。出ている場合は設定を直して再デプロイ。  
- `/api/rooms/create` への `curl -i` で `x-matched-path: /500` かつ `__NEXT_DATA__.nextExport=true` が返る場合は、静的エクスポートが配信されているサイン。ビルド設定を修正して再デプロイする。  
- 追加ガード: `scripts/verify-api-routes.js` を `postbuild` で実行し、`.next/server/app/api/rooms/create/route.js` などが無ければビルドを失敗させる。Vercel ビルドが静的化しているときはここで止まる。  

### 4.2 部屋作成が本番だけ 405/500 になるときのチェックリスト
1. **症状確認**  
   - `curl -i https://numberlink.vercel.app/api/rooms/create` → `x-matched-path: /500` と HTML が返る。`__NEXT_DATA__.nextExport:true` が埋まっていると静的エクスポート配信。  
   - `curl -i -X POST https://numberlink.vercel.app/api/rooms/create -d '{}' -H 'Content-Type: application/json'` → 405/500 で同じく `/500` にマッチしている。  
2. **Vercel Project 設定を確認**（Settings → Build & Development Settings）  
   - Framework Preset = Next.js  
   - Build Command = `npm run build`（Overrides があれば OFF にする）  
   - Output Directory = 空欄（`out` が入っていたら削除）  
   - Production Overrides が残っていないか。黄色帯が出ていたらクリックし、Output/Build の上書きを消す。  
3. **ドメインの紐づけ確認**（Settings → Domains）  
   - `numberlink.vercel.app` が現在のプロジェクトの Production Deployment を指しているか。別プロジェクトの古い static 出力に紐付いていないか確認。  
4. **Production Deployment のビルドログを確認**  
   - Deployment 詳細で「Using Next.js Runtime」になっているか。`Static File Export` や `.vercel/output/static` になっていれば再デプロイ。  
   - Redeploy する際は「Run Build」を有効にし、prebuilt output は使わない。  
5. **再デプロイ後の確認**  
   - `curl -i https://numberlink.vercel.app/api/rooms/create` → 404 または 405 が JSON/空レスポンスで返る（HTML 500 ではない）。  
   - `curl -i -X POST ... -d '{}'` → `400 {"error":"invalid_body"}` など API ハンドラのレスポンスが返る。  
   - UI で「部屋作成 → 入室 → ゲーム開始 → リセット → 新規部屋作成」が通ることを確認。  

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

### 5.1 Lobby / Presence 運用メモ
- RTDB presence が安定している前提で `NEXT_PUBLIC_LOBBY_VERIFY_SINGLE` / `NEXT_PUBLIC_LOBBY_VERIFY_MULTI` は既定 OFF。必要なときだけ一時的に有効化する。  
- Firestore へのフォールバック集計を完全停止したい場合は `NEXT_PUBLIC_DISABLE_FS_FALLBACK=1` を設定する（その間のロビー人数は 0 固定になる）。本番で presence が健全なときだけ使用する。  

### 5.2 Audio Ready / 結果サウンド再生（2025-11）
- `SoundProvider` 起動時に Web Audio のウォームアップと「勝利/敗北」の prewarm を完了したら `window.__AUDIO_READY__` と内部 ready promise を解決する実装に更新。  
- 結果サウンドは新 API `playResultSound({ outcome, delayMs?, reason? })` を経由させる。ready 待ち・一意制御・ユーザー設定（normal/epic）マッピング・タブ遅延での解錠までを内部で担当。  
- SHOWTIME / GameResultOverlay は `audio.play(result_*)` / `playResultSound` で呼び出せば 2.6 秒以内の重複を自動抑止し、常に 1 回だけ鳴る。  
- 調査時はコンソールで `__ITO_LAST_RESULT_SOUND_AT__`, `__ITO_RESULT_SOUND_PENDING__`, `__ITO_RESULT_SOUND_SCHEDULED_AT__` を確認すると状態が分かる。  

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

### 6.1.1 放置タブ向けの追加確認（Vercel）
- `sw-meta.js` が 2 分ごとにフェッチされ、レスポンスヘッダー `X-SW-META-VERSION` が最新ビルドになっているか確認する。
- 同じページを開きっぱなしでも 3〜5 分以内に `waiting` が立ち、バナー／ミニドックが点灯すること（ゲーム中は自動適用せずバナーのみ）。
- フェッチが発生しない場合はタイマースロットがブラウザによりサスペンドされていないか（背景タブの `setInterval` 冷却など）を確認し、必要に応じてフォーカスさせて再現する。

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

---

## 14. ルームごとのアプリバージョン固定（2025-12）
- `rooms/{roomId}.appVersion` に作成時の APP_VERSION を保存し、部屋ごとに世界線を固定する。
- 作成・参加時は `/api/rooms/version-check` を経由してサーバー版との一致を確認する。
  - **作成**: `clientVersion !== サーバーAPP_VERSION` なら `room/create/update-required` を返し、更新を促す。
  - **参加**: `room.appVersion` と `clientVersion` が不一致なら `room/join/version-mismatch` を返し、参加を拒否（ペイロードに `roomVersion`/`clientVersion` を含む）。
- 旧データ互換のため `appVersion` が無い既存ルームは一旦許可する（初回参加時に新しい部屋を立て直してもらう想定）。
- 問い合わせ対応メッセージ例: 「この部屋は古いバージョンで進行中です。最新版では参加できないため、新しい部屋を作成して合流してください。」

---

## 15. API1本化 完了メモ（2025-12-07）

### 15.1 状態のまとめ
- rooms / players への永続書き込みは、**部屋作成を含めてすべて Next.js API 経由** に統一済み。
  - 部屋作成: `components/CreateRoomModal.tsx` → `lib/services/roomApiClient.ts` の `apiCreateRoom` → `POST /api/room/create` → `lib/server/roomCommands.createRoom`.
  - 進行系: `/api/rooms/[roomId]/join|ready|deal|submit-clue|submit-order|commit-play|continue|finalize|reset|topic|mvp|players/*|reveal-pending|round-preparing|prune-proposal` など。
  - 例外は `lib/firebase/rooms.leaveRoom` などに残っている「API 失敗時のみ実行されるフォールバック」のみ（通常フローでは通らない）。
- UI / hooks から Firestore に直接 `setDoc` / `updateDoc` / `runTransaction` するコードは撤廃済み（Presence/RTDB 系を除く）。
- **追加例外（2025-12-09）**: `components/hooks/useRevealAnimation.ts` の `runRealtimeEvaluation` 内で `room.result` を先行保存する処理が残存。これはリビール演出中の UX 最適化のための例外として許容。冪等な `runTransaction` + 既存 result チェックで安全性を担保しており、最終確定は `finalizeReveal` API が行う。

### 15.2 jsdom / isomorphic-dompurify 由来の本番クラッシュ（再発防止メモ）
- 2025-12-05〜07 にかけて、Vercel 本番環境で `/api/rooms/create` など一部 API が **静的 500 HTML**（`x-matched-path: /500`, `nextExport: true`）を返す事象が発生した。
  - ログには `Error [ERR_REQUIRE_ESM]: require() of ES Module .../jsdom/...` が出ていた。
  - 原因: `lib/utils/sanitize.ts` で `isomorphic-dompurify`（内部で `jsdom` 使用）をサーバー側でも読み込んでいたことによる、Node.js 22 の ESM/CommonJS 互換性エラー。
- 対策:
  - `lib/utils/sanitize.ts` を **純粋な文字列処理ベースの `sanitizePlainText`** に差し替え、`jsdom` / `isomorphic-dompurify` 依存を完全に削除。
  - これにより、create-room を含む全 API がローカル / 本番ともに安定動作することを確認済み。
- 運用上の注意:
  - サーバー側コード（`lib/server/*`, `app/api/*`, `pages/api/*`）に `jsdom` / `isomorphic-dompurify` を再導入しない。
  - サニタイズを強化したい場合は、現行の `sanitizePlainText` を拡張するか、ブラウザ専用の DOM ベースサニタイズはクライアント限定で利用する。
  - 本番 API が再び「HTML 500 を返す」「`x-matched-path: /500` になる」場合は、まず node_modules 由来の ESM エラー（`ERR_REQUIRE_ESM`）が出ていないかログを確認する。

### 15.3 潜在バグリスクと注意点（2025-12-09 レビュー）

#### 入室/退室/ホスト権限
- **正常動作確認済み**: 入室 (`apiJoinRoom`)、退室 (`apiLeaveRoom`)、ホスト権限移譲 (`claim-host`, `transfer-host`) は全て API 経由。
  - 退室 API: `POST /api/rooms/[roomId]/leave`（`{ uid, token, displayName? }`）。本人の token と uid が一致しない場合は拒否。
  - タブ閉じ/ページ離脱: `useLeaveCleanup` が `sendBeacon` / `keepalive fetch` で退室 API を叩く（重い処理・二重送信は避ける）。
- **フォールバック**: `lib/firebase/rooms.ts` の `applyClientSideLeaveFallback` は API 失敗時のみ実行される非常用処理。通常フローでは通らない。
- **注意**: ゲーム進行中（`clue` / `reveal` / `finished`）でのホスト退室時、自動的にホスト権限が移譲されない場合がある。その場合は残りのプレイヤーが `claim-host` を呼ぶ必要あり。

#### 観戦モード
- **正常動作確認済み**: XState ベースの `spectatorSessionMachine` + API ルート (`/api/spectator/*`) で処理。
- **潜在リスク**: 観戦者がいる状態で部屋がリセット (`/api/rooms/[roomId]/reset`) されると、観戦セッションの状態と部屋の状態にずれが生じる可能性がある。
  - 現状: `ui.recallOpen` が `false` にリセットされるため、観戦者は自動的に呼び戻しを要求できなくなる。
  - 対策: リセット後にホストが「席に戻す」を開ければ問題なし。自動処理が必要な場合は将来的に `reset` API 内で `recallOpen: true` を設定するか検討。
- **ゲーム進行中の直入り**: 強制観戦ゲート (`spectator.gate`) でブロックされるため、途中参加者がゲームを壊すことはない。

#### Service Worker / Safe Update
- **正常動作確認済み**: XState ベースの状態機械 (`updateChannel.ts`) が堅牢に実装。
- **潜在リスク**: 旧 SW が残ったままデプロイが行われた場合、`version-check` で弾かれて入室できない可能性がある。
  - 対策: `room.appVersion` が未設定の古いルームは一旦許可する設計になっている。新しいルームを作り直してもらう運用で対処。
- **部屋滞在中の自動更新抑制**: `useRoomMachineController` でページ単位で管理。部屋にいる間（waiting 含む全フェーズ）は `holdInGameAutoApply()` で抑止し、部屋退出時に `releaseInGameAutoApply()` で解除。`window.__ITO_METRICS__.safeUpdate` で確認可能。
