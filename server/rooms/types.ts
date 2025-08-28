export type RoomStatus = 'waiting' | 'in-progress' | 'finished';
export type RoomVisibility = 'public' | 'private' | 'locked';

export interface RoomSummary {
  id: string;
  name: string;
  status: RoomStatus;
  visibility: RoomVisibility;
  capacity: number;
  playerCount: number;
  hostId: string;
  createdAt: number; // epoch ms
}

export interface CreateRoomPayload {
  id: string;
  name: string;
  capacity: number;
}

export interface StartRoomPayload { id: string }
export interface DeleteRoomPayload { id: string }

