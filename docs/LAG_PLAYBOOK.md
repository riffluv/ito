# Lag Audit & Telemetry Playbook

ゲームのレスポンスを維持するために、新たに追加したメトリクス／UX 改善点と、ラグ調査時の手順をまとめました。6〜8人同時プレイを想定し、DebugMetricsHUD（`NEXT_PUBLIC_DEBUG_METRICS=1`）を有効化した状態で確認してください。

## テレメトリ信号

| Scope.Key | 発火元 | 意味 |
| --------- | ------ | ---- |
| `drag.activationLatencyMs` | `CentralCardBoard` | 最後に計測した「pointer down → drag start」までのレイテンシ（ms）。100ms 超が続く場合はセンサー遅延や throttling を疑う。 |
| `drag.boostEnabled` | `CentralCardBoard` | Drag Boost が有効化されているか（1 = on）。0 のままの場合は drag センサー切替が失敗している。 |
| `safeUpdate.phase` / `safeUpdate.waitingVersion` | `useServiceWorkerUpdate` | SW の現在フェーズ・待機バージョン。`auto_pending` が長い場合は背景 API の応答を確認。 |
| `hostAction.quickStart.latencyMs` / `.reset.latencyMs` | `useHostActions` | ホスト主要ボタンのリクエスト〜応答までの経過時間。1.5s を超える場合は Functions/Firestore の滞留を疑う。 |
| `hostAction.quickStart.pending` 等 | `useHostActions` | 0/1 でペンディング状態を示す。HUD で 1 が残り続ける場合は UI か back-end が hung。 |
| `room.status` | `app/rooms/[roomId]/page.tsx` | FSM 上のフェーズ。切り替え時刻（`phase.transitionAt`）と合わせて、フェーズ遷移の滞留を把握できる。 |
| `participants.onlineCount` | `useParticipants` | presence 監視が返しているオンライン人数。presence ready の判定と合わせて使用。 |
| `client.drop.*` | `useDropHandler` | ドロップ操作のステージ別レイテンシ分布（`resolveMs` など）。rollback が多発していないか監視する。 |

## 既知のラグ要因と対策

1. **初回ドラッグの立ち上がり**  
   - DnD Kit の `activationConstraint` を Drag Boost で動的に切り替え、初回 pointer 以降は distance=1/delay=短いモードに遷移。  
   - `drag.activationLatencyMs` が 120ms を超える場合は、HUD を開き `drag.boostEnabled` が 1 になっているか確認。0 の場合は pointer down が盤面に届いていないため、BoardRef の張り替え漏れ等を疑う。

2. **ホスト操作の体感遅延**  
   - Quick Start / Reset / Restart は `useHostActions` で即時トースト（pending 状態）を表示し、応答後に成功/失敗と計測値をメトリクスへ送出。  
   - Functions 側で 2s 以上かかる場合は HUD の `hostAction.quickStart.latencyMs` を参照し、`traceAction("ui.host.quickStart.result")` と突き合わせて原因を掴む。

3. **フェーズ切り替えが遅い／不明瞭**  
   - `app/rooms/[roomId]/page.tsx` でフェーズの変更を `phase.status` および `phase.transitionAt` に記録。  
   - HUD と Room Machine のトレース（`traceAction("#roomMachine...")`）を併用し、どのフェーズで止まっているか一目で分かる。

4. **Service Worker / バージョン差異**  
   - Safe Update バナー（自動適用カウントダウン + 再同期ボタン）を常時表示し、`safeUpdate` メトリクスと同じフェーズを HUD から監視できる。  
   - `safeUpdate.phase` が `suppressed` のままなら Drag/Narration などで force apply をホールドしている可能性があるので、`releaseForceApplyTimer` の発火条件を確認する。

5. **Presence / サウンド準備遅延**  
   - `useParticipants` で `participants.onlineCount` を更新し、presence hydrate 前後の ready 状態を HUD に表示。  
   - `useDropHandler` では pointer ダウンで audio resume を行うため、`NPP_AUDIO_RESUME_ON_POINTER=1` のときは pointer イベントが拾われる位置に UI を配置する（BoardFrame 以外で阻害されていないか確認）。

## 調査フロー

1. `NEXT_PUBLIC_DEBUG_METRICS=1` をセットして HUD を表示。  
2. 問題のシナリオ（例えば 8 人同時入室 → ドラッグ → ホスト quick start）を再現。  
3. HUD 上で異常値があるキーを確認し、対応する `traceAction` / console log をフィルタ。  
4. 追加で必要なログは `lib/utils/log.ts` 経由で lazy 取得できる（`globalThis.console` に差し替え済み）。

## 今後のフォローアップ

- `safeUpdate` 系以外のチャネル（音声／Pixi 背景）についても同様のメトリクスを Hook 化する。  
- `docs/performance-report.md` と本プレイブックをリンクし、将来のエージェントが着手前に目を通せるよう README へ記載する。

このプレイブックを起点に、ラグを感じたらまず HUD でシグナルを確認し、該当コード（hook / service）を追う運用に統一してください。
