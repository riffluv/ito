export type RoomOptions = {
  allowContinueAfterFail: boolean;
  // クリア方式: 順番に出す or 並び替え一括判定
  // resolveMode: 現在は順番出しのみサポート
  resolveMode?: "sequential";
};

export type RoomDoc = {
  name: string;
  hostId: string;
  options: RoomOptions;
  // フェーズはUI仕様に合わせて拡張（後方互換のため "playing" も許容）
  status: "waiting" | "clue" | "reveal" | "finished" | "playing";
  createdAt?: any;
  lastActiveAt?: any;
  // ソフトクローズ管理
  closedAt?: any | null;
  expiresAt?: any | null;
  // お題
  topic?: string | null;
  topicOptions?: string[] | null;
  // 選択中のカテゴリ（通常版/レインボー版/クラシック版）
  topicBox?: "通常版" | "レインボー版" | "クラシック版" | null;
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
  uid?: string | null;
  text: string;
  createdAt?: any;
};
