# Lobby Latency & Presence Tuning

ロビー表示の人数カウントは RTDB presence を主経路にしつつ、フェイルセーフとして Firestore fallback を持った二段構成になっています。本ドキュメントでは、揺れの少ない人数表示と復帰の速さを両立させるための主要チューニングポイントと、観測に使うメトリクスをまとめます。

## 主要な環境変数

| 変数名                                                               | 既定値                                                                                                                             | 役割                                                 | 備考                                                                                |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_LOBBY_STALE_MS`                                         | `35_000` ms (presence stale 閾値より短い方を採用)                                                                                  | presence のタイムスタンプ鮮度しきい値                | `PRESENCE_HEARTBEAT_MS + 5s` 以上に強制される                                       |
| `NEXT_PUBLIC_LOBBY_ZERO_FREEZE_MS`                                   | presence: `max(20s, LOBBY_STALE_MS + 5s)` → 既定 `40_000` ms<br>fallback: `min(ACTIVE_WINDOW_MS + 10s, 30_000)` → 既定 `30_000` ms | 「0人判定」直後に値を維持するクールダウン            | presence と fallback で別々に評価。値を下げるほど復帰は速いが、スパイクしやすくなる |
| `NEXT_PUBLIC_LOBBY_INPROGRESS_LIMIT`                                 | `6`                                                                                                                                | 進行中（`clue`/`reveal`）ルームの最大表示件数        | 1ページ (`ROOMS_PER_PAGE = 6`) 以上を常に取得。必要に応じて増減可能                 |
| `NEXT_PUBLIC_LOBBY_RECENT_WINDOW_MS`                                 | `180_000` ms (3分)                                                                                                                 | 「最近のルーム」判定に使う `lastActiveAt` ウィンドウ | ウィンドウを広げると古いルームも並ぶが、初回 fetch が重くなる                       |
| `NEXT_PUBLIC_LOBBY_VERIFY_SINGLE` / `NEXT_PUBLIC_LOBBY_VERIFY_MULTI` | `false`                                                                                                                            | presence ゴーストを Firestore で検証するオプション   | 単一 UID / 複数 UID の両方を個別にオンオフ可能                                      |
| `NEXT_PUBLIC_DISABLE_FS_FALLBACK`                                    | `false`                                                                                                                            | Firestore fallback を完全停止                        | 緊急時のみ使用。fallback のポーリング自体が止まる                                   |

## ゼロフリーズの挙動

- presence 系列では `zero-freeze-start` で freeze を開始し、プレイヤー復帰が確認できると `zero-freeze-end` で解除します。既定では 40 秒のクールダウンですが、新鮮な JOIN 判定 (`ACCEPT_FRESH_MS = 5s`) と Firestore 検証で早期解除されるケースがあります。
- Firestore fallback 系列では活動窓 (`ACTIVE_WINDOW_MS`) を基準にした freeze を採用しつつ、上限 30 秒でクランプしています。presence が落ちて fallback に切り替わった場合でも、ロビーが 0 ↔︎ N を短時間に往復しにくくなります。

## 監視とメトリクス

`useLobbyCounts` から以下のログイベントが発火します。Axiom / Datadog などで集計し、freeze が過剰に続いていないか監視してください。

- `zero-freeze-start`：`{ roomId, source: "presence" | "fallback", freezeMs }`
- `zero-freeze-end`：`{ roomId, source, durationMs }`

`source` で presence / fallback を判別できます。duration が freezeMs を大きく超える場合は解除ロジックが機能していない可能性があります。

## 推奨運用の目安

1. **通常運転**：既定値のままで、ロビー表示の揺れが許容範囲内か確認します。
2. **復帰優先**：`NEXT_PUBLIC_LOBBY_ZERO_FREEZE_MS` を短くすると戻りが速くなりますが、presence のゴースト検証 (`VERIFY_*`) を併用して跳ね返りを抑制してください。
3. **ピークタイム**：進行中ルームをより多く見せたい場合は `NEXT_PUBLIC_LOBBY_INPROGRESS_LIMIT` を引き上げます。ページング負荷が増える場合は `MAX_RECENT_FETCH` の調整も検討します。
4. **デバッグ**：`NEXT_PUBLIC_LOBBY_DEBUG_UIDS=1` でローカルのコンソールに presence の UID リストを出力できます。

本ドキュメントに記載が無い調整を行う場合は、freeze ログとともに変更前後の観測値を残し、恒久化前に必ずロビーの体感確認を実施してください。
