// React用の最小フック。Socket.IOクライアントを受け取りロビー一覧を管理します。
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';

export type RoomStatus = 'waiting' | 'in-progress' | 'finished';
export type RoomVisibility = 'public' | 'private' | 'locked';
export type RoomSummary = {
  id: string;
  name: string;
  status: RoomStatus;
  visibility: RoomVisibility;
  capacity: number;
  playerCount: number;
  hostId: string;
  createdAt: number;
};

type State = {
  rooms: Record<string, RoomSummary>;
  setRooms: (rs: RoomSummary[]) => void;
  upsert: (r: RoomSummary) => void;
  remove: (id: string) => void;
};

export const useLobbyStore = create<State>((set) => ({
  rooms: {},
  setRooms: (rs) => set({ rooms: Object.fromEntries(rs.map(r => [r.id, r])) }),
  upsert: (r) => set((s) => ({ rooms: { ...s.rooms, [r.id]: r } })),
  remove: (id) => set((s) => { const next = { ...s.rooms }; delete next[id]; return { rooms: next }; }),
}));

export function useLobby(socket: any) {
  const { setRooms, upsert, remove } = useLobbyStore();

  useEffect(() => {
    if (!socket) return;
    const onSnapshot = (rs: RoomSummary[]) => setRooms(rs);
    const onUpsert = (r: RoomSummary) => upsert(r);
    const onDelete = ({ id }: { id: string }) => remove(id);

    socket.emit('rooms:snapshot');
    socket.on('rooms:snapshot', onSnapshot);
    socket.on('rooms:upsert', onUpsert);
    socket.on('rooms:delete', onDelete);

    return () => {
      socket.off('rooms:snapshot', onSnapshot);
      socket.off('rooms:upsert', onUpsert);
      socket.off('rooms:delete', onDelete);
    };
  }, [socket, setRooms, upsert, remove]);

  const rooms = useLobbyStore(s => s.rooms);
  const visibleRooms = useMemo(
    () => Object.values(rooms).filter(r => r.visibility === 'public' && (r.status === 'waiting' || r.status === 'in-progress')),
    [rooms]
  );

  return { visibleRooms };
}

