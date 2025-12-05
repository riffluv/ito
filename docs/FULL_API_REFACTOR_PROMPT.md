# 序の紋章 III フル API 化リファクタ指示書（codex-max 用）

> このファイルは、次のエージェント（codex-max）が「ルーム関連の書き込みを原則すべて Next.js API 経由に寄せる」ためのリファクタ指示です。  
> **挙動を変えずに、書き込み経路を API / サーバー主導に統一する**ことが目的です。

---

## 0. 前提・守るべきポリシー

あなたは OpenAI Codex CLI（GPT ベースの Coding Agent）です。  
このリポジトリ `/home/hr-hm/Project/jomonsho` には `AGENTS.md` があり、以下のポリシーを**絶対に崩さないでください**:

- Server-Authoritative（サーバー主導）
- Presence は RTDB を唯一のソース
- Firestore / RTDB への書き込みは service 層・API 層経由で行い、UI から直接書かない
- XState ベースの FSM（roomMachine）は常時有効

さらに、すでに以下は実装済みです（この前提を壊さないこと）:

- ルームごとの `appVersion` メタデータ付与（ルーム作成時に stamp 済み）
- `/api/rooms/version-check` による
  - 「新規ルーム作成時のバージョンチェック（古い版からの作成は禁止）」  
  - 「既存ルーム参加時のクライアント版 vs ルーム版整合チェック」
- `lib/server/roomVersionGate.ts` の `checkRoomVersionGuard` による
  - 観戦系 API でのサーバーサイド版ガード
- クライアント側の参加系フローで
  - `APP_VERSION` を送りつつ `/api/rooms/version-check` を叩き
  - バージョン不一致時に `RoomServiceError("ROOM_VERSION_MISMATCH")` + トーストで参加を止める

**今回のフル API 化は、これらの「A案ガチ（部屋ごとバージョン固定）」の設計に乗っかったまま、書き込み経路を API に揃える作業です。**

---

## 1. ゴールと非ゴール

### ゴール（今回やること）

- ルームやゲーム進行に関わる **Firestore/RTDB への書き込み** を、原則すべて Next.js API 経由に寄せる。
  - API からは Firebase Admin SDK 経由で書き込む。
  - クライアント SDK での直接 write は「UI 専用のごく一部（必要な場合）」に限定する。
- 既存の hooks / components / services の **公開 API（型と挙動）を出来る限り変えない** まま、内部実装だけ API 経由に差し替える。
- 「A案ガチ」の振る舞い（部屋ごとの `appVersion` 固定・バージョンミスマッチの扱い）を**そのまま維持**する。
- `npm run typecheck` / `npm run lint` を通す。

### 非ゴール（今回やらないこと）

- ゲームのルール変更・UI の大幅な挙動変更（勝敗ロジック、カード演出など）。
- Presence (RTDB) の API 化（Presence はこれまで通り RTDB を唯一のソースとして扱う。必要なら後続フェーズで検討）。
- Safe Update / PWA まわりの挙動変更（`lib/telemetry/safeUpdate.ts` 等には手を入れない）。
- 新しいボス戦・ギミックの追加（今回は「基盤」のリファクタに集中する）。

---

## 2. 全体方針（設計レベル）

大方針は以下です。

- **「ゲームの世界線を変える書き込み」は全部 API 経由**に寄せる。  
  例: ルーム作成 / 参加 / 退出 / ready 切り替え / 数字・クルー提出 / リセット / 結果確定 / ホスト操作 など。
- API からは `lib/server/firebaseAdmin` の Admin SDK 経由で Firestore を更新する。
- クライアント側は、これまで `lib/game/service.ts` などでやっていた Firestore 直 write を
  - `fetch("/api/rooms/...")`
  - または API 専用の client service (`lib/services/...ApiClient.ts` など)
  に差し替える。
- API では必ず
  - Auth / uid の検証
  - `checkRoomVersionGuard` による `appVersion` 整合性チェック
  - 適切なトレース (`traceAction` / `traceError`) を入れる。
- Presence（RTDB 心拍）や「完全にローカルな UI 設定」など、ゲームの世界線を変えないものは、必要であれば例外としてそのままでもよい。

---

## 3. フェーズ構成

安全・確実に進めるため、以下のフェーズに分けて作業してください。

各フェーズの最後で必ず `npm run typecheck` と `npm run lint` を実行し、エラーがない状態で次に進んでください。

### Phase 0: 現状調査と方針の固定

**目的:** どこが Firestore/RTDB に書いているのか、どの API が既に存在するのかを把握する。

1. `AGENTS.md` を読み直し、Server-Authoritative / Presence / FSM まわりの方針を再確認する。
2. Firestore クライアント SDK を使った書き込み箇所を洗い出す。
   - `firebase/firestore` の `setDoc`, `updateDoc`, `addDoc`, `deleteDoc`, `runTransaction` などを `rg` で検索。
   - 特に `rooms` コレクションとそのサブコレクション（`players`, `events`, `watchers` 等）への書き込みを一覧化する。
3. RTDB (`firebase/database`) の `set`, `update`, `push`, `remove` などの書き込み箇所もリストアップする（Presence 用かどうか確認）。
4. 既存の Next.js API Route を把握する。
   - 例: `app/api/rooms/[roomId]/reset/route.ts`, `app/api/rooms/[roomId]/claim-host/route.ts`, 観戦系の API など。
5. バージョンガード周りを確認する。
   - `lib/constants/appVersion.ts`
   - `app/api/rooms/version-check/route.ts`
   - `lib/server/roomVersionGate.ts` (`checkRoomVersionGuard`, `versionsEqual` 等)
6. 調査の結果は、コード内コメントか簡単なメモ（`docs/` 配下の短い md など）でよいので、どこに何があるか分かる形で残す。

> 注: Phase 0 は「コードの大掃除」ではなく「地図作り」です。ここではまだ挙動を変えないでください。

---

### Phase 1: サーバー側の共通コマンド層を用意する

**目的:** ルームやゲームの「書き込みロジック」を一箇所に集約し、API から呼べるようにする。

1. 新しいサーバー側モジュールを作成する。
   - 例: `lib/server/roomWriteService.ts` または `lib/server/roomCommands.ts`  
   - 名前はどちらでもよいが、**「ルーム状態を変えるためのサーバー専用サービス」**であることが分かるようにする。
2. このモジュールには、以下のような責務を持たせる:
   - Admin Firestore を使って `rooms` / `players` / 必要なサブコレクションを書き換える。
   - `lib/game/domain.ts` や `lib/state/roomMachine.ts` などの既存ドメインロジックを再利用し、**UI 側のロジックを持ち込まない**。
   - コマンド関数は「何をしたいか」が分かる単位でまとめる。例:
     - `createRoom(params)`
     - `joinRoomAsPlayer(params)`
     - `leaveRoom(params)`
     - `updatePlayerReadyState(params)`
     - `submitNumber(params)`
     - `submitClue(params)`
     - `hostResetRoom(params)`
     - `hostCloseRoom(params)`
   - ここではまだ「どこから呼ばれるか（API / Functions / 将来の別エントリ）」を意識しすぎず、「正しい書き込みを行う純粋なサーバーサービス」として設計する。
3. 既存のロジックから「明らかにサーバー側に移すべき書き込み処理」を少しずつ移植する。
   - 例: `components/CreateRoomModal.tsx` にあるルーム作成時の `setDoc` ロジックなどを、`createRoom` コマンドに寄せる。
   - **このタイミングではまだクライアント側の呼び出し元は変えない**。同じロジックが二重に存在しないよう注意しつつ、まずは「サーバー版の正しい書き方」を確立することを優先する。
4. `traceAction` / `traceError` を適切な位置に仕込む。
   - ルーム作成・リセット・結果確定など「重要イベント」は、既存のトレース方針に沿って trace を追加する。

フェーズ末尾チェック:

- `npm run typecheck`
- `npm run lint`

---

### Phase 2: API Route を整備して「書き込み入口」を統一する

**目的:** ルーム関連の書き込み操作に対応する API Route を揃え、Phase 1 のサーバーサービスから呼び出す形にする。

1. `app/api/rooms/` 配下の構成を確認し、必要に応じてサブルートを追加する。
   - 例:
     - `app/api/rooms/create/route.ts`（新規ルーム作成）
     - `app/api/rooms/[roomId]/join/route.ts`
     - `app/api/rooms/[roomId]/leave/route.ts`
     - `app/api/rooms/[roomId]/ready/route.ts`
     - `app/api/rooms/[roomId]/submit-number/route.ts`
     - `app/api/rooms/[roomId]/submit-clue/route.ts`
     - `app/api/rooms/[roomId]/host/reset/route.ts`（既存 reset を移行/統合）
     - など、既存のサービス関数に対応する範囲で整理する。
   - すでに存在する API（`reset`, `claim-host`, 観戦系など）は可能な範囲で **Phase 1 のサーバーサービスに寄せる**。
2. 各 API Route では、共通して以下を行う:
   - 認証済みユーザーであることの確認（uid 取得）。
   - リクエスト body のバリデーション（Zod など既存バリデーションユーティリティがあれば再利用）。
   - `checkRoomVersionGuard(roomId, clientVersion)` を使った **サーバーサイド版ガード**。
     - `clientVersion` は原則 `APP_VERSION` を送らせる（足りない場合は 400）。
     - ミスマッチ時は `409` + `error: "room/join/version-mismatch"` を返す。
   - ロールチェック（ホスト専用操作かどうか、観戦者かどうか）を行い、権限がなければ `403` を返す。
   - Phase 1 で作ったサーバーサービス関数を呼ぶ。
   - 成功時のレスポンスは、必要であれば更新後の一部状態やメタ情報を返す（クライアントが冪等に扱える形）。
3. エラー処理・トレース:
   - 失敗時には `traceError` を呼び、`NextResponse.json` で
     - `error` コード（例: `"room/join/version-mismatch"`, `"permission_denied"`, `"invalid_payload"` など）
     - 必要なら `roomId`, `uid`, `roomVersion`, `clientVersion`
     を返す。
   - 成功時には `traceAction` で主要イベントを記録する（既存の trace 名称に合わせる）。
4. 既存の `/api/rooms/version-check` や `checkRoomVersionGuard` と**矛盾しない**よう注意する。
   - バージョンチェックのロジックを二重に持たず、可能な限り `checkRoomVersionGuard` を使い回す。

フェーズ末尾チェック:

- `npm run typecheck`
- `npm run lint`
- 最低限、ルーム作成 API とリセット API については簡単な手動確認（開発環境）を行う。

---

### Phase 3: クライアントサービスを API 経由に差し替える

**目的:** これまで Firestore クライアント SDK で直接書き込んでいた箇所を、Phase 2 の API Route を叩く形に切り替える。

1. クライアント側の「サービス層」を特定する。
   - 例: `lib/game/service.ts`, `lib/services/roomService.ts`, `lib/hooks/useCardSubmission.ts`, `lib/hooks/useHostActions.ts` など。
   - **UI コンポーネントから直接 Firestore を叩いている箇所**があれば、原則サービス層に寄せる。
2. 各サービス関数がやっていることを整理する。
   - 今どのコレクション/ドキュメントに何を書いているか。
   - どのようなトランザクション/バッチ単位で動いているか。
3. それぞれを、対応する API Route 呼び出しに置き換える。
   - 既存の関数シグネチャ（引数・戻り値）は**可能な限り維持**する。
   - 内部実装だけを
     - Firestore 直 write → `fetch("/api/rooms/...")`
     に差し替える。
   - バージョンチェックやエラーコードの扱いは、既存の挙動（`RoomServiceError` など）に揃える。
4. 必要であれば、**一時的なフラグ**を導入しても構わない。
   - 例: `NEXT_PUBLIC_ROOM_API_WRITES_ONLY` もしくは `NEXT_PUBLIC_ROOM_API_ENABLED` など。
   - フラグ ON で API 経由、OFF で従来の Firestore 直 write を使うようにしておけば、段階的な切り替え・検証がしやすい。
   - ただし最終形では「ゲームの世界線に関わる書き込みは API 経由のみ」に収束させること。
5. Presence (RTDB) 心拍や、完全に UI ローカルな設定は例外として残してよい。
   - ただし AGENTS の方針通り、「Presence は RTDB を唯一のソース」とする設計を崩さない。

フェーズ末尾チェック:

- `npm run typecheck`
- `npm run lint`
- 必要に応じて以下のテストを1本以上実行（時間に応じて選択）:
  - `npm run test`
  - `npx playwright test tests/roomMachine.spec.ts`
  - その他、ルーム入室/提出/リセットに関わる既存テスト

---

### Phase 4: クリーンアップ & ルールの将来対応メモ

**目的:** フル API 化後に、余計な経路やコメントを整理し、将来の Firestore ルール強化に備える。

1. 使われなくなった Firestore 直 write のヘルパーや関数があれば削除する。
   - ただし、Phase 3 で導入したフラグにまだ依存している場合は、完全に切り替えが終わるまで残す。
2. `docs/OPERATIONS.md` などに、以下の運用ポリシーを追記する。
   - 「ルーム状態に関わる書き込みはすべて API 経由で行う」
   - 「クライアントは Firestore に直接書き込まない（Presence の例外を除く）」
   - 「ルームは作成時の appVersion で固定され、新しいバージョンのクライアントは途中参加できない（A案ガチ）」
3. `firestore.rules` については**今回は大きく変更しない**。  
   - 将来、「クライアントからの rooms 書き込みを完全に禁止する」タイミングで、別途ルール変更 + デプロイが必要になる旨をコメントに残す程度に留める。

フェーズ末尾チェック:

- `npm run typecheck`
- `npm run lint`

---

## 4. 守ってほしい細かい注意点

- **挙動を変えないこと**  
  - ルームの状態遷移・FSM の進み方・バージョンチェックのルールは変えない。
  - 既存のトースト文言・エラーコードも、意味が変わらない範囲で維持する。
- **import path の変更は最小限に**  
  - 既存の hooks / components の公開 API は壊さない。
  - サービス内部の実装を差し替える形で進める。
- **Server-Authoritative を崩さない**  
  - 新しく Firestore/RTDB に書く必要が出た場合も、必ずサーバー側サービス or 既存 service 層を経由する。
  - UI から Admin SDK を直接触るような設計は絶対にしない。
- **Presence / RTDB の扱いに注意**  
  - Presence のソースは RTDB のみ。Firestore の lastSeen には戻さない。
  - 人数判定は `presenceReady` を待つ設計を壊さない。
- **テストを適宜実行する**  
  - 大きなフェーズの切り替え前後で、少なくとも `npm run typecheck` / `npm run lint` を必ず走らせる。
  - 可能なら、ルームの入室〜提出〜リセットまでを通す E2E テストを1本以上実行し、回 regress を防ぐ。

---

## 5. 期待する最終状態（まとめ）

フル API 化が完了した時点で、以下の状態になっていることを目指します。

- ルームやゲーム進行（状態遷移）に関わる書き込みは、すべて Next.js API 経由で行われる。
- API は `lib/server/roomVersionGate.ts` / `APP_VERSION` と連携して、「部屋ごとのバージョン固定（A案ガチ）」をサーバー側でも保証している。
- クライアント側の hooks / components / services の公開 API はほぼそのまま（呼び出し側から見た使い方は変わらない）。
- Presence は RTDB を唯一のソースとして維持され、人数判定や入室可否ロジックは既存の設計通り。
- `npm run typecheck` / `npm run lint` が問題なく通る。
- トピック操作（select/shuffle/custom/reset）、MVP 投票、UI フラグ (`ui.revealPending` / `ui.roundPreparing`)、プレイヤープロフィール更新・状態リセットは新設の API ルート（`/topic` / `/mvp` / `/reveal-pending` / `/round-preparing` / `/players/profile` / `/players/reset`）に統一し、クライアントの Firestore 直書きは撤廃済み。

この状態まで実装できていれば、「据え置き機のような体感」と「サービスとしての堅牢さ（サーバー主導・チート耐性・将来のマネタイズ/企業研修/パブリッシャー対応）」の両方に備えた基盤が整ったとみなせます。
