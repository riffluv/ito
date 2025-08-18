export type RoomOptions = {
  allowSecondClue: boolean;
  passLimit: number;
  allowContinueAfterFail: boolean;
};

export type RoomDoc = {
  name: string;
  hostId: string;
  options: RoomOptions;
  status: "waiting" | "playing" | "finished";
  createdAt?: any;
  lastActiveAt?: any;
  result?: {
    success: boolean;
    revealedAt: any;
  } | null;
  deal?: {
    seed: string;
    min: number;
    max: number;
  } | null;
  round?: number;
};

export type PlayerDoc = {
  name: string;
  avatar: string;
  number: number | null;
  clue1: string;
  clue2: string;
  ready: boolean;
  orderIndex: number;
  uid?: string;
  lastSeen?: any;
};

export type ChatDoc = {
  sender: string;
  text: string;
  createdAt?: any;
};
