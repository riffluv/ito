import { FieldValue, Timestamp } from "firebase/firestore";

export type RoomOptions = {
  allowContinueAfterFail: boolean;
  /**
   * クリア方式 (resolveMode) - sanitize 時に常に正規化され、必須となる
   * - "sort-submit": 全員がカード(伏せ/連想ワード表示)を場に置き、相談しながら並べ替えてホストが一括判定
   */
  resolveMode: "sort-submit";
  /**
   * カード表示モード
   * - "full": 全員のカード+連想ワードが見える（協力モード）
   * - "minimal": 自分のカードのみ表示（エキスパートモード）
   */
  displayMode?: "full" | "minimal";
  /**
   * デフォルトお題タイプ
   * ワンクリック開始時に使用されるお題の山札タイプ
   */
  defaultTopicType?: "通常版" | "レインボー版" | "クラシック版" | "カスタム";
};

export type PlayerSnapshot = {
  name: string;
  avatar: string;
  clue1: string;
  number: number | null;
};

export type RoomDoc = {
  name: string;
  hostId: string;
  requiresPassword?: boolean;
  passwordHash?: string | null;
  passwordSalt?: string | null;
  passwordVersion?: number | null;
  hostName?: string; // ホスト名（Firestore最適化のため直接埋め込み）
  creatorId: string;
  creatorName?: string;
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
    proposal?: (string | null)[] | null;
    numbers?: Record<string, number | null | undefined> | null;
    snapshots?: Record<string, PlayerSnapshot> | null;
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
    seatHistory?: Record<string, number>;
  } | null;
  round?: number;
  // MVP投票 (記録簿内で完結)
  mvpVotes?: Record<string, string> | null; // { voterId: votedPlayerId }
  // --- Version Align (PWA update) ---
  updatePhase?: 'required' | 'done' | undefined;
  requiredSwVersion?: string | undefined;
  // --- UI State (Spectator V3) ---
  ui?: {
    /**
     * 観戦者の入席許可フラグ (Spectator V3)
     * true: リセット後の waiting 状態のみ（観戦者が「席に戻る」を許可）
     * false: ゲーム中・次ゲーム準備中など（観戦者の入席を拒否）
     */
    recallOpen?: boolean;
    /** Reveal 自動再開時のUI側ペンディングフラグ */
    revealPending?: boolean;
    /** Reveal開始のサーバータイムスタンプ（UI側で参照） */
    revealBeginAt?: Timestamp | FieldValue | null;
    /** ラウンド準備中（カード配布中など）を共有するフラグ */
    roundPreparing?: boolean;
  };
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
  joinedAt?: Timestamp | FieldValue;
};

export type ChatDoc = {
  sender: string;
  uid?: string | null;
  text: string;
  createdAt?: Timestamp | FieldValue;
};
