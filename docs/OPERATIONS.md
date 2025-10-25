# OPERATIONS ガイドライン

このドキュメントは「序の紋章 III（オンライン版）」を安定運用するための運用手順・監視ポイント・トラブルシュート方法をまとめたものです。新しいメンバーが参画した際はまずここを確認し、必要に応じて更新してください。

---

## 1. プロジェクト概要
- **技術スタック**: Next.js 14（App Router）/ TypeScript / Chakra UI / Pixi.js / GSAP / Firebase（Firestore + RTDB + Auth + Functions）/ Stripe
- **主要環境変数**  
  - `NEXT_PUBLIC_APP_VERSION`: ビルド識別子。Safe Update の差分判定にも利用。  
  - `NEXT_PUBLIC_ENABLE_PWA`: PWA / Service Worker を有効化。  
  - `NEXT_PUBLIC_FEATURE_SAFE_UPDATE`: Safe Update フローを有効化。  
  - `NEXT_PUBLIC_FSM_ENABLE`: XState ベースの新ルームマシンを切り替え。  
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

## 9. よく使うコマンド／スクリプト
- **Playwright 個別実行**: `npx playwright test tests/roomMachine.spec.ts`  
- **Firestore ルールのデプロイ**: `firebase deploy --only firestore:rules`  
- **Functions ローカルテスト**: `npm --prefix functions run lint && npm --prefix functions test`  
- **パフォーマンス計測（Pixi）**: `npm run dev` 起動後、`docs/performance-report.md` の手順に従う。  

---

## 10. ドキュメント更新の運用
- 仕様や運用手順を変更した場合は、PR の一部として `docs/` 以下も更新する。  
- `AGENTS.md`, `CLAUDE.md`, `docs/SAFE_UPDATE_TEST_PLAN.md` などロール別ハンドブックとの整合を保つ。  
- 重大な更新を行ったときは `CHANGELOG.md`（未整備の場合は新規作成）やチーム内共有ツールで告知する。  

---

最終更新日: 2025-10-25  
編集者: Codex（GPT-5 ベース）
