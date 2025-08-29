import React from 'react';
import { useLobby } from './useLobby';

export function RoomListExample({ socket }: { socket: any }) {
  const { visibleRooms } = useLobby(socket);

  return (
    <div>
      <h3>ロビー</h3>
      <ul>
        {visibleRooms.map((r: any) => (
          <li key={r.id}>
            <strong>{r.name}</strong>
            {' '}
            <span>({r.playerCount}/{r.capacity})</span>
            {' '}<em>{r.status}</em>
          </li>
        ))}
      </ul>
      {visibleRooms.length === 0 && <p>部屋がありません</p>}
    </div>
  );
}

