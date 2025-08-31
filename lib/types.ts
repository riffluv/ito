import { FieldValue, Timestamp } from "firebase/firestore";

export type RoomOptions = {
  allowContinueAfterFail: boolean;
  /**
   * クリア方式 (resolveMode) - sanitize 時に常に正規化され、必須となる
   * - "sequential": 従来の 1 枚ずつ昇順で出して随時判定
   * - "sort-submit": 全員がカード(伏せ/連想ワード表示)を場に置き、相談しながら並べ替えてホストが一括判定
   */
  resolveMode: "sequential" | "sort-submit";
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
  // フェーズは waiting -> clue -> (reveal) -> finished に限定
  status: "waiting" | "clue" | "reveal" | "finished";
  createdAt?: Timestamp | FieldValue;
  lastActiveAt?: Timestamp | FieldValue;
  // ソフトクローズ管理
  closedAt?: Timestamp | FieldValue | null;
  expiresAt?: Timestamp | FieldValue | null;
  // お題
  topic?: string | null;
  topicOptions?: string[] | null;
  // 選択中のカテゴリ（通常版/レインボー版/クラシック版）
  topicBox?: "通常版" | "レインボー版" | "クラシック版" | null;
  // ホスト確定時の順序
  order?: {
    list: string[];
    decidedAt?: Timestamp | FieldValue;
    lastNumber?: number | null;
    failed?: boolean;
    failedAt?: number | null;
    total?: number | null;
    proposal?: string[] | null;
  } | null;
  result?: {
    success: boolean;
    revealedAt: Timestamp | FieldValue;
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
  lastSeen?: Timestamp | FieldValue;
};

export type ChatDoc = {
  sender: string;
  uid?: string | null;
  text: string;
  createdAt?: Timestamp | FieldValue;
};
