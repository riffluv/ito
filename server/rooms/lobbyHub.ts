import type { Server, Socket } from 'socket.io';
import { InMemoryRoomStore } from './store';
import type { CreateRoomPayload, DeleteRoomPayload, RoomSummary, StartRoomPayload } from './types';

type LobbyHubOptions = {
  roomAutoLockOnFull?: boolean; // 満員で locked にする
  hideInProgressFromLobby?: boolean; // 進行中をロビーから隠す
  autoSnapshotOnConnect?: boolean; // 接続直後に一覧を自動送信
  compatBroadcastAllIfNoLobby?: boolean; // ロビー未加入でも全員へ配信フォールバック
  compatEventAliases?: Record<string, string[]>; // 互換イベント名の同時配信
};

export class LobbyHub {
  private readonly io: Server;
  private readonly store: InMemoryRoomStore;
  private readonly opts: LobbyHubOptions;

  constructor(io: Server, store: InMemoryRoomStore, opts?: LobbyHubOptions) {
    this.io = io;
    this.store = store;
    this.opts = {
      roomAutoLockOnFull: true,
      hideInProgressFromLobby: false,
      autoSnapshotOnConnect: true,
      compatBroadcastAllIfNoLobby: true,
      compatEventAliases: {
        'rooms:upsert': ['room:upsert', 'rooms:update'],
        'rooms:delete': ['room:delete'],
      },
      ...opts,
    };
  }

  attach() {
    const emitLobby = (ev: string, payload: unknown) => {
      const size = this.io.sockets.adapter.rooms.get('lobby')?.size ?? 0;
      const useFallback = size === 0 && this.opts.compatBroadcastAllIfNoLobby;
      // 観測用ログ（必要に応じて置換）
      console.log(`[lobby] ->${size} emit ${ev}${useFallback ? ' (fallback: io.emit)' : ''}`);
      const emitTo = useFallback ? this.io : this.io.to('lobby');
      emitTo.emit(ev, payload);
      // 互換イベント名の同時配信
      const aliases = this.opts.compatEventAliases?.[ev] ?? [];
      if (aliases.length) {
        aliases.forEach(a => emitTo.emit(a, payload));
      }
    };

    this.io.on('connection', (socket: Socket) => {
      // デフォルトでロビーに参加（UIで明示的に制御したい場合は lobby:subscribe を使う）
      socket.join('lobby');
      if (this.opts.autoSnapshotOnConnect) {
        const list = this.store.listPublic().filter(r =>
          this.opts.hideInProgressFromLobby ? r.status === 'waiting' : true
        );
        // 次ティックで送信して join の完了順序と衝突しないようにする
        setTimeout(() => socket.emit('rooms:snapshot', list), 0);
      }

      socket.on('lobby:subscribe', () => socket.join('lobby'));
      socket.on('lobby:unsubscribe', () => socket.leave('lobby'));

      socket.on('rooms:snapshot', () => {
        const list = this.store.listPublic().filter(r =>
          this.opts.hideInProgressFromLobby ? r.status === 'waiting' : true
        );
        socket.emit('rooms:snapshot', list);
      });

      socket.on('room:create', (p: CreateRoomPayload) => {
        if (!p?.id || !p?.name || !p?.capacity) return;
        const room: RoomSummary = {
          id: p.id,
          name: p.name,
          capacity: Math.max(1, Math.floor(p.capacity)),
          status: 'waiting',
          visibility: 'public',
          playerCount: 1,
          hostId: socket.id,
          createdAt: Date.now(),
        };
        this.store.create(room);
        emitLobby('rooms:upsert', room);
      });

      socket.on('room:start', ({ id }: StartRoomPayload) => {
        const now = this.store.get(id);
        if (!now) return;
        if (now.hostId !== socket.id) return; // ホストのみ
        const next = this.store.update(id, { status: 'in-progress' });
        if (!next) return;
        emitLobby('rooms:upsert', next);
      });

      socket.on('room:update', (patch: Partial<RoomSummary> & { id: string }) => {
        const now = this.store.get(patch.id);
        if (!now) return;
        if (now.hostId !== socket.id) return; // ホストのみ
        const next = this.store.update(patch.id, sanitizePatch(patch));
        if (!next) return;
        emitLobby('rooms:upsert', next);
      });

      socket.on('room:delete', ({ id }: DeleteRoomPayload) => {
        const now = this.store.get(id);
        if (!now) return;
        if (now.hostId !== socket.id) return; // ホストのみ
        if (this.store.delete(id)) emitLobby('rooms:delete', { id });
      });

      socket.on('disconnect', () => {
        // 必要であればホスト切断時の後始末をここに追加
      });
    });

    // 定期掃除（任意）
    setInterval(() => this.store.prune(), 60_000).unref?.();
  }
}

function sanitizePatch(p: Partial<RoomSummary>): Partial<RoomSummary> {
  const out: Partial<RoomSummary> = {};
  if (p.name) out.name = p.name;
  if (p.status) out.status = p.status;
  if (p.visibility) out.visibility = p.visibility;
  if (typeof p.capacity === 'number') out.capacity = Math.max(1, Math.floor(p.capacity));
  if (typeof p.playerCount === 'number') out.playerCount = Math.max(0, Math.floor(p.playerCount));
  return out;
}
