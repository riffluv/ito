// 最小の統合例: Node + Express + Socket.IO
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { InMemoryRoomStore } from './rooms/store';
import { LobbyHub } from './rooms/lobbyHub';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const store = new InMemoryRoomStore({ ttlMs: 1000 * 60 * 60 });
new LobbyHub(io, store, { hideInProgressFromLobby: false }).attach();

app.get('/health', (_req, res) => res.json({ ok: true }));

server.listen(3001, () => {
  console.log('Realtime server on http://localhost:3001');
});

