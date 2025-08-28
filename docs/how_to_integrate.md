# ロビー実装の統合手順（最小）

このフォルダに生成した `server/rooms/*` と `client/lobby/*` は、
Socket.IO ベースのロビー/部屋表示の最小実装です。既存プロジェクトに以下の形で組み込みできます。

## サーバ

1) 既存の Socket.IO 初期化箇所で `LobbyHub` を組み込みます。

```ts
import { Server } from 'socket.io';
import { InMemoryRoomStore } from './rooms/store';
import { LobbyHub } from './rooms/lobbyHub';

const io = new Server(httpServer, { cors: { origin: '*' } });
const store = new InMemoryRoomStore();
new LobbyHub(io, store, { hideInProgressFromLobby: false }).attach();
```

2) ルーム作成/開始の自前ロジックがある場合は、`io.to('lobby').emit('rooms:upsert'| 'rooms:delete')` を必ず呼ぶよう統一してください。

3) 新規部屋は `status: 'waiting'`, `visibility: 'public'` を初期値に。

## クライアント

1) ロビー画面マウント時に `useLobby(socket)` を呼び、`visibleRooms` を一覧に描画します。

```tsx
import { io } from 'socket.io-client';
import { RoomListExample } from './client/lobby/RoomListExample';

const socket = io('http://localhost:3001');
<RoomListExample socket={socket} />
```

2) 一覧が表示されない場合のチェック:

- 接続直後に `socket.join('lobby')` が行われているか
- `rooms:snapshot` を受信しているか
- `rooms:upsert` が `io.to('lobby').emit` で配信されているか

## よくある落とし穴

- `socket.emit` のみで、他参加者に配信していない（`io.to('lobby').emit` にする）
- 部屋作成直後に `status: 'in-progress'` や `visibility: 'locked'` にしてしまい、一覧フィルタに引っかからない
- クライアントが `rooms:upsert`/`rooms:delete` を購読していない

