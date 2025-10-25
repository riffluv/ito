# Safe Update 自動適用フロー見直し（2025-10-25）調査メモ

## 背景
- NEXT_PUBLIC_FEATURE_SAFE_UPDATE=1 で運用していたが、長時間起動しているクライアントで新ビルドが適用されず、更新バナー／ボタンも表示されない事象が継続していた。
- インストール型（PWA）では「更新中…」の表示で停止し、そのままローカルキャッシュが更新されないケースが複数報告されていた。

## 現象の整理
1. **アップデート検知が届かないクライアントがある**  
   - 1タブだけで `updatefound` が発火し、他タブでは `registration.waiting` を参照しても null のままになる。  
   - その結果、`useServiceWorkerUpdate` が `isUpdateReady=false` のままになり、更新ボタンが描画されない。
2. **`applyServiceWorkerUpdate` の結果が未完了で停止する**  
   - `SKIP_WAITING` 送信後に `controllerchange` が届かないと `isApplying` が true のまま固定され、ループガードも発火しない。  
   - PWA インストール環境では window.reload がブロックされ、ローディングでフリーズ。
3. **本番リリース後に再検知されない**  
   - `navigator.serviceWorker.register` を一度実行すると、その後 `registration.update()` を明示的に呼ばない限りチェックが行われず、24時間以上経過すると更新が止まる。

## 根本原因
| 症状 | 原因 | 詳細 |
| ---- | ---- | ---- |
| 更新バナーが表示されない | 更新待機イベントが他タブへ伝搬していない | `announceServiceWorkerUpdate` が BroadcastChannel 等で共有されておらず、更新を検知したタブ以外に情報が届かなかった。 |
| 更新中に固まる | 適用成功/失敗のハンドリング不足 | `SKIP_WAITING` 後のタイムアウト監視やエラー復帰がなく、`waiting` が `redundant` になっても失敗扱いにならない。 |
| 新ビルドを拾えない | 定期的な `registration.update()` が無い | 初回登録以降に明示的なチェックが無く、長時間起動したクライアントは更新を取りこぼしていた。 |

## 実施した対策（コード側）
1. **状態管理レイヤーを全面刷新**  
   - `lib/serviceWorker/updateChannel.ts` を SafeUpdate ストア化し、`phase / lastError / waitingSince` 等のスナップショットを提供。  
   - BroadcastChannel と `postMessage` を併用し、どのタブでも待機状態を即時共有。
2. **適用フローの堅牢化**  
   - 適用タイムアウト（12 秒）と冪等な失敗処理を追加。  
   - `clearWaitingServiceWorker` が `activated / redundant` を識別し、成功時のみ `state.phase=applied` へ遷移。  
   - 失敗時は `state.phase=failed` で UI に再試行を促し、テレメトリへ detail を送出。
3. **Service Worker 側の通知を強化**  
   - `BroadcastChannel("ito-safe-update-v1")` と `SAFE_UPDATE_SYNC` メッセージで install/activate/skipWaiting を配信。  
   - install/activate 後に `notifyUpdateChannels` を呼び、全クライアントへ再同期を指示。
4. **定期チェックと可視化**  
   - `registerServiceWorker` 後に 15 分間隔の `registration.update()` と、タブ復帰時の即時チェックを追加。  
   - `markUpdateCheckStart/End` を通じて状態遷移をフロントから追跡可能に。  
   - ループガード発動時に手動適用へフォールバックできる UI を整備。
5. **UI/UX 改善**  
   - バナーとバッジが `phase` と `lastError` を表示し、タイムアウトや抑止状態を明示。  
   - 再試行ボタン／手動適用ボタンのテキストを状況に応じて切り替え。

## 今後の監視・TODO
- テレメトリ `safe_update.*` の失敗件数を 1デプロイ後に確認し、継続的なループ発生を監視。  
- iOS Safari (standalone) での挙動を実機確認し、追加のワークアラウンドが必要か検証。  
- 長時間（24h 以上）起動セッションに対する E2E テストを追加する案を検討。

---
作成者: Codex（2025-10-25）  
対象コミット: safe-update manager 再構築一式
