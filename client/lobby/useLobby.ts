// React用の最小フック。Socket.IOクライアントを受け取りロビー一覧を管理します。
import { useEffect, useState, useMemo } from 'react';

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

// シンプルなuseState-based実装
function useLobbyState() {
  const [rooms, setRoomsState] = useState<Record<string, RoomSummary>>({});

  const setRooms = (rs: RoomSummary[]) => {
    setRoomsState(Object.fromEntries(rs.map(r => [r.id, r])));
  };

  const upsert = (r: RoomSummary) => {
    setRoomsState(prev => ({ ...prev, [r.id]: r }));
  };

  const remove = (id: string) => {
    setRoomsState(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return { rooms, setRooms, upsert, remove };
}

export function useLobby(socket: any) {
  const { rooms, setRooms, upsert, remove } = useLobbyState();

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

  const visibleRooms = useMemo(
    () => Object.values(rooms).filter(r => r.visibility === 'public' && (r.status === 'waiting' || r.status === 'in-progress')),
    [rooms]
  );

  return { visibleRooms };
}