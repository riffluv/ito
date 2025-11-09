以下を新チャットの先頭に貼って、そのエージェントに実装させてください。プロ向けの完全指示です。

— 指示ここから —

目的

UI/Hook からの Firestore 直叩きを排し、GameService 経由に統一する。
書き込みと購読の入口を一元化し、trace/エラーハンドリング/計測をサービス層で集中管理する。
既存の動作（ゲーム進行、PWA Safe Update、Pixi 表示）を壊さず、段階的に移行する。
背景

現状は一部 Hook/コンポーネントで firebase/firestore を直接呼んでいる（設計方針と不一致）。
Firebase 継続前提でも、I/F 集約は保守性・運用性・テスト容易性の観点で有益。
スコープ（今回やること）

書き込み系の直叩きを GameService に集約（優先度高）。
主要購読の入り口を GameService に用意し、Hook から利用（段階導入）。
traceAction/traceError とメトリクス（lib/utils/metrics.ts）送出をサービス層に集約。
非スコープ（今回やらない）

Firebase 自体の置き換え（Supabase 等）やデータスキーマ変更。
画面 UI/UX の大きな変更、PWA Safe Update の再設計。
既存テストの大規模追加（必要最低限の影響確認のみ）。
ターゲットファイル

追加/変更の中心:
lib/game/service.ts
lib/hooks/useClueInput.ts
lib/hooks/useHostActions.ts
lib/hooks/useRoomState.ts
components/ui/MiniHandDock.tsx（Firestore import 残骸の撤去）
参照のみ（低レイヤ実装はそのまま活用）:
lib/firebase/*.ts（players.ts / rooms.ts など）
実装方針（段階導入）

Phase 1（書き込みの集約：必須）

GameService に I/F を追加（下記シグネチャ例）。内部では lib/firebase/* を呼び、成功/失敗時に trace とメトリクスを送出する。
updateClue(roomId: string, playerId: string, text: string): Promise<void>
setPlayerReady(roomId: string, playerId: string, ready: boolean): Promise<void>
renamePlayer(roomId: string, playerId: string, name: string, avatar?: string): Promise<void>
reorderPlayers(roomId: string, order: string[]): Promise<void>
必要に応じて postChat, emitRoomEvent など、既存の直叩きがある最小限のみ。
useClueInput.ts の updateClue1 直接呼び出しを GameService.updateClue に差し替え。
useHostActions.ts の getDoc/updateDoc 直叩き箇所を相当 I/F に差し替え（存在しない I/F は上記に追加）。
components/ui/MiniHandDock.tsx から firebase/firestore の import を除去（使っていない実体も削る）。
Phase 2（購読の入り口を用意：安全に）

GameService に購読 I/F を追加（購読解除を返す形で）。
watchRoom(roomId: string, cb: (room: RoomDoc | null) => void): () => void
watchPlayers(roomId: string, cb: (players: PlayerDoc[]) => void): () => void
useRoomState.ts のうち、影響が小さい購読 1〜2 箇所を watch* I/F 経由に置き換え（挙動一致確認のため段階導入）。
ここでも成功/失敗を trace（traceAction('watch.room.start') / traceError('watch.room.error') 等）し、メトリクスへ最小値を記録。
Phase 3（ガードとチェック）

ルール化：components/** と lib/hooks/** 直下では firebase/firestore の import を禁止。実装コストが許せば ESLint カスタムルール、難しければリポ内 grep スクリプトを package.json の lint に追加。
既存の traceAction/traceError 名称は既存命名（safeUpdate など）に合わせること。
I/F 例（lib/game/service.ts）

既存方針を踏襲：UI/Hook → GameService（ここで trace/metrics/try-catch）→ lib/firebase/*。
例：
export const GameService = { updateClue, setPlayerReady, watchRoom, watchPlayers, ... }
失敗時は必ず traceError('service.updateClue', err, { roomId, playerId }) を記録し、エラーをそのままスロー（呼び側の既存 UI ロジックがエラーハンドルする前提）。
成功時は traceAction('service.updateClue', { … }) とメトリクス bumpMetric('service','updateClue.ok') を送出。
受け入れ基準（Definition of Done）

機能:
useClueInput.ts と useHostActions.ts の書き込み系直叩きが GameService 経由に置き換わっている。
1 箇所以上の購読（onSnapshot）が GameService.watch* 経由に変更され、挙動差なし。
components/ui/MiniHandDock.tsx から firebase/firestore の import が消えている。
品質:
npm run typecheck が通る。
主要ルームフロー（ルーム作成→参加→連想→提出→結果→次ゲーム）をブラウザで一巡し、機能退行なし。
Console に新しい未処理エラー・警告が増えていない（既知警告は現状維持で可）。
運用/観測:
新設 I/F で traceAction/traceError が発火し、DevTools Console で "[trace:action]" / "[trace:error]" が確認できる。
コード規約:
触れたファイルは既存スタイルに合わせ、差分は必要最小限。
コメントは要所のみ（過度に増やさない）。
確認手順（最小）

コマンド:
npm run typecheck
手動:
ローカルでルーム立ち上げ→テキスト入力→提出（useClueInput 経由の書き込みが動作）。
ホストアクション（次のゲーム開始/リセット等）を一通りクリック（useHostActions 経由の書き込みが動作）。
ルーム状態がリアルタイムで更新される（watch* の購読が動作）。
Console で trace ログの発火を確認。
リスク/注意

差し替えの過程で購読解除（unsubscribe）の漏れが出やすい。useEffect の cleanup で () => unwatch() を必ず返すこと。
例外はサービス層で握り潰さない。trace + 再スローの原則を守ること（UI 側既存ハンドラに任せる）。
PWA Safe Update / Pixi まわりの差分は出さない（本タスクはデータ層の縫い目整理に限定）。
進め方

PR は小さく刻む（Phase 1 → Phase 2）。Phase 1 が通ったら Phase 2 を着手。
途中で曖昧な箇所があれば、差し替え対象の箇所（ファイル:行）と提案 I/F を短く質問。
— 指示ここまで —

この文面を渡せば、次のエージェントが安全に段階導入できます。必要なら、最初の PR（Phase 1）の差分案までこちらで用意します。
