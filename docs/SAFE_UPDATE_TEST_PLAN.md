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
