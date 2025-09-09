// カード表示とアニメーション状態の管理
// sort-submitモードのみサポート
import type { PlayerDoc } from "@/lib/types";

export type ResolveMode = "sort-submit" | string | undefined;
export type RoomStatus =
  | "waiting"
  | "clue"
  | "reveal"
  | "finished"
  | string
  | undefined;

export interface ComputeCardStateParams {
  player: (PlayerDoc & { id: string }) | undefined;
  id: string;
  idx?: number; // index within ordered/reveal context
  orderList?: string[]; // confirmed order
  pending: string[]; // local optimistic placements
  proposal?: string[]; // sort-submit local proposal
  resolveMode?: ResolveMode;
  roomStatus?: RoomStatus;
  revealIndex: number; // how many cards have been revealed (exclusive upper bound)
  revealAnimating: boolean;
  failed?: boolean; // server confirmed overall failure
  boundaryPreviousIndex?: number | null; // index (0-based) of card just before failure boundary (for subtle highlight)
  realtimeResult?: {
    success: boolean;
    failedAt: number | null;
    currentIndex: number;
  } | null; // リアルタイム判定結果
}

export interface ComputedCardState {
  showNumber: boolean; // whether numeric value should be rendered
  variant: "flat" | "flip"; // which card visual to use
  flipped: boolean; // for flip variant: whether backside (number) is shown
  state: "default" | "success" | "fail"; // coloring state
  boundary?: boolean; // marks the card right before failure for subtle emphasis
  successLevel?: "mild" | "final"; // refine success into per-card mild vs final celebration
  clueText: string | null; // clue to show (may be placeholder)
  number: number | null; // numeric value or null if hidden
  revealed: boolean; // whether the card is considered revealed in game logic
  waitingInCentral: boolean; // whether this card is waiting in central area (Dragon Quest style)
}

// Consolidated logic for sort-submit mode only (sequential mode removed).
export function computeCardState(p: ComputeCardStateParams): ComputedCardState {
  const idx = p.idx;
  const number = p.player?.number ?? null;
  const clue1 = p.player?.clue1 ?? "";
  const isPlaced = !!(
    (p.orderList && p.orderList.includes(p.id)) ||
    p.pending.includes(p.id) ||
    (p.proposal && p.proposal.includes(p.id))
  );

  // 1) Number visibility - sort-submit mode only
  let showNumber = false;
  if (p.roomStatus === "reveal" && p.revealAnimating) {
    if (typeof idx === "number" && idx < p.revealIndex) {
      showNumber = typeof number === "number" && isPlaced;
    }
  } else if (p.roomStatus === "finished") {
    showNumber = typeof number === "number" && isPlaced;
  }

  // 2) Failure / success computation - リアルタイム判定のみ（事前計算削除）
  const hasRealtimeResult = p.realtimeResult != null;
  const realtimeFailed = hasRealtimeResult ? !p.realtimeResult!.success : false;
  const realtimeFailedAt = hasRealtimeResult
    ? p.realtimeResult!.failedAt
    : null;

  const flipPhaseReached = typeof idx === "number" && idx < p.revealIndex;
  const revealed =
    typeof idx === "number" &&
    (p.roomStatus === "finished" ||
      (p.roomStatus === "reveal" && idx < p.revealIndex));

  let isFail = false;
  let isSuccess = false;
  let successLevel: ComputedCardState["successLevel"] = undefined;
  let boundary = false;

  const active = p.roomStatus === "finished" || flipPhaseReached;

  // 3) Variant & flip state - sort-submit mode only
  const variant: ComputedCardState["variant"] =
    p.roomStatus === "reveal" || p.roomStatus === "finished" ? "flip" : "flat";

  const flipped = (() => {
    if (variant !== "flip") return false;

    // 基本原則：数字を表示すべき状態なら必ずflipする
    // これによりアニメーション中とデザイン時の一貫性を保つ
    if (showNumber) return true;

    // finished では全カードが数値面を向く（最終結果表示）
    if (p.roomStatus === "finished" && isPlaced) {
      return true;
    }

    return false;
  })();

  // ★ 修正：カードがflippedまたはshowNumberの状態の時のみ失敗/成功状態を適用
  // これにより、カードが裏面の時に境界線の色が変わってネタバレすることを防ぐ
  const shouldShowResult = flipped || showNumber || p.roomStatus === "finished";

  if (shouldShowResult) {
    // シンプルなITOルール: めくり完了時に昇順判定
    // 1枚では判定不可、2枚以上で判定開始

    if (p.roomStatus === "finished") {
      // ゲーム終了時: サーバー確定結果を使用
      isFail = revealed && active && Boolean(p.failed);
      isSuccess = revealed && active && !Boolean(p.failed);
    } else if (
      p.roomStatus === "reveal" &&
      revealed &&
      active &&
      p.revealIndex >= 2
    ) {
      // めくりアニメーション中: リアルタイム判定または事前判定を使用
      if (hasRealtimeResult) {
        // リアルタイム判定結果があればそれを使用
        isFail = !p.realtimeResult!.success;
      } else if (p.failed) {
        // サーバーの事前判定結果を使用
        isFail = true;
      }
    }

    if (isSuccess) successLevel = "final";
  }

  if (
    typeof idx === "number" &&
    typeof p.boundaryPreviousIndex === "number" &&
    idx === p.boundaryPreviousIndex
  ) {
    boundary = true;
  }

  // 4) Clue text
  const clueText =
    p.roomStatus !== "finished" ? clue1 || "(連想待ち)" : clue1 || null;

  // 5) Waiting in central detection - ALWAYS TRUE for Dragon Quest style
  // 全てのカードでドラゴンクエスト風デザインを適用
  const waitingInCentral = true;

  return {
    showNumber,
    variant,
    flipped,
    state: isFail ? "fail" : isSuccess ? "success" : "default",
    boundary,
    successLevel,
    clueText,
    number: showNumber && typeof number === "number" ? number : null,
    revealed,
    waitingInCentral,
  };
}
