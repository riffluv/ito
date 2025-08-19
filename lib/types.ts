export type RoomOptions = {
  allowContinueAfterFail: boolean;
};

export type RoomDoc = {
  name: string;
  hostId: string;
  options: RoomOptions;
  // フェーズはUI仕様に合わせて拡張（後方互換のため "playing" も許容）
  status: "waiting" | "clue" | "reveal" | "finished" | "playing";
  createdAt?: any;
  lastActiveAt?: any;
  // お題
  topic?: string | null;
  topicOptions?: string[] | null;
  // ホスト確定時の順序
  order?: {
    list: string[];
    decidedAt?: any;
    lastNumber?: number | null;
    failed?: boolean;
    failedAt?: number | null;
    total?: number | null;
  proposal?: string[] | null;
  } | null;
  result?: {
    success: boolean;
    revealedAt: any;
  } | null;
  deal?: {
    seed: string;
    min: number;
    max: number;
    players?: string[];
  } | null;
  round?: number;
};

export type PlayerDoc = {
  name: string;
  avatar: string;
  number: number | null;
  clue1: string;
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
