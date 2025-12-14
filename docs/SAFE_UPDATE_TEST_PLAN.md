# Safe Update 検証手順

## 1. 事前準備
1. `.env.local` で `NEXT_PUBLIC_ENABLE_PWA=1` と `NEXT_PUBLIC_FEATURE_SAFE_UPDATE=1` を設定する。  
2. `npm run dev` を起動し、`http://localhost:3000` を Chrome の通常タブとシークレットタブで開く。  
3. DevTools > Application > Service Workers で「Update on reload」を無効にしておく（自動更新を無効化）。

## 2. 旧ビルド → 新ビルドの切り替え
1. ターミナル A: `npm run build && npm run start` で旧ビルドを起動。  
2. ブラウザでゲーム画面を開き、`window.__ITO_METRICS__.safeUpdate` が初期化されていることを確認。  
3. ターミナル B: `NEXT_PUBLIC_APP_VERSION=$(date +%Y%m%d%H%M%S) npm run build && npm run start` で新ビルドを起動。  
4. 旧ビルドを表示しているタブで数秒待ち、ミニドック／Safe Update バナーに「新しいバージョン」表示が出ることを確認（`phase` は `auto_pending` または `waiting_user` になる）。  
5. `navigator.serviceWorker.getRegistration().then(r => !!r?.waiting)` が `true` になることを確認。  
6. 画面を非表示にする（別タブへ切り替える）か、DevTools で `Skip waiting` を押し、10 秒以内に自動リロードされることを確認。

### 2.5 放置タブ（Vercel 本番相当）での検知
- 旧ビルドを表示したまま **操作せずに 3〜5 分放置** し、新しいデプロイを完了させる。
- DevTools Network を開き、`sw.js?v=...` と `sw-meta.js` のフェッチが 2 分ごとに発生しているかを確認する（`sw-meta.js` は `X-SW-META-VERSION` ヘッダー付きで最新ビルドの値を返す）。
- Application > Service Workers で `waiting` が付いた registration が立ち、ミニドック／Safe Update バナーが表示されること。
- ゲーム進行中はバナーのみ表示され、自動リロードが抑止されていること（in-game hold）。

> memo: 2025-12-01 時点で precache リストを最小化（`/_next/static/chunks/main.js` を削除）し、`sw.js` に `Cache-Control: no-store, must-revalidate` を付与した。DevTools Network で `/_next/static/chunks/main.js` の 404 が出ないことを確認する。

## 3. 失敗パス（タイムアウト・エラー）の確認
1. `navigator.serviceWorker.getRegistration()` で待機中の Service Worker を取得し、DevTools Network タブで「Offline」を有効にする。  
2. ミニドックの「今すぐ更新」を押し、`safe_update.failure` が記録されて UI が「再試行」に変わることを確認（`phase` は `failed` / `retryCount` が増える）。  
3. オフラインを解除し、再度「再試行」を押して正常に更新されることを確認。

## 4. ログ／メトリクスの確認ポイント
- `window.__ITO_METRICS__.safeUpdate`  
  - `deferred` / `applied` / `failure` / `suppressed` が意図通りに増減するか。  
- Console ログ（`[safe-update:triggered]` など）がタイムラインと一致するか。  
- `navigator.serviceWorker.controller` 変更後にページが 1 度だけリロードされるか（ループしていないか）。

## 5. PWA インストール版での確認
1. Chrome の「インストール」からアプリ化し、スタンドアロンで起動。  
2. 手順 2 と同様に新ビルドをデプロイし、自動更新が機能するかを確認。  
3. 失敗パスも 1 回実施し、再試行ボタンで復帰できることを確認。

## 6. 自動テスト
- Jest: `npm run test -- safeUpdateMachine.test.ts`（自動適用成功 / 手動適用成功 / 失敗→再試行 の 3 シナリオをカバー）
- 手動検証前後でテストを実行し、FSM の主要シナリオが崩れていないことを確認する。

## 7. 部屋滞在中の抑止ガイド
- **部屋にいる間（waiting 含む全フェーズ）** は `holdInGameAutoApply()` を送って自動適用を抑止する。
- **部屋を退出したタイミング（RoomPage アンマウント）** で `releaseInGameAutoApply()` を呼んで解除する。
- これにより「同じ部屋にいる間は旧バージョンで固定、部屋を出たら最新版へ更新可能」という仕様になる。
- BroadcastChannel 経由で全タブ同期される。
- **ゲーム中（suppressed 状態）は手動適用ボタンを表示しない**。8人プレイ中に誰かが誤って更新を押してゲームが中断されるリスクを防ぐため。
- バナー文言は「プレイ中のため自動更新を保留中です。メインメニューに戻ると更新されます。」と表示される。
- デプロイ頻度が高い場合も、部屋を出た瞬間に自動適用されるため、ゲーム中の強制リロードを防ぎつつ最新化を維持できる。
