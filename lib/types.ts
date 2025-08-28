export type RoomOptions = {
  allowContinueAfterFail: boolean;
  /**
   * クリア方式 (resolveMode)
   * - "sequential": 従来の 1 枚ずつ昇順で出して随時判定
   * - "sort-submit": 全員がカード(伏せ/連想ワード表示)を場に置き、相談しながら並べ替えてホストが一括判定
   */
  resolveMode?: "sequential" | "sort-submit";
  /**
   * デフォルトお題タイプ
   * ワンクリック開始時に使用されるお題の山札タイプ
   */
  defaultTopicType?: "通常版" | "レインボー版" | "クラシック版";
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
