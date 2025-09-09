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

  // 2) Failure / success computation - リアルタイム判定
  const hasRealtimeResult = p.realtimeResult != null;
  const realtimeFailedAt = hasRealtimeResult
    ? p.realtimeResult!.failedAt
    : null;
  const judgedUpTo = hasRealtimeResult
    ? (p.realtimeResult!.currentIndex ?? 0)
    : 0;
  const realtimeSuccess = hasRealtimeResult
    ? p.realtimeResult!.success === true
    : false;

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
    if (showNumber) return true; // 表示すべきときはflip
    if (p.roomStatus === "finished" && isPlaced) return true; // 終了時は全て数値面
    return false;
  })();

  // カードが裏面のときは色出しを抑制
  const shouldShowResult = flipped || showNumber || p.roomStatus === "finished";

  if (shouldShowResult && revealed && active) {
    if (p.roomStatus === "reveal") {
      if (p.revealIndex >= 2 && hasRealtimeResult && typeof idx === "number") {
        if (typeof realtimeFailedAt === "number") {
          // 失敗: 現在まで(=judgedUpTo)にめくられたカードは全て赤
          if (idx + 1 <= judgedUpTo) isFail = true;
        } else if (realtimeSuccess) {
          // 成功継続: 現在まで(=judgedUpTo)にめくられたカードは全て緑
          if (idx + 1 <= judgedUpTo) isSuccess = true;
        }
      }
    } else if (p.roomStatus === "finished") {
      // 終了時: リアルタイム結果またはサーバー確定で最終表示
      if (hasRealtimeResult && typeof idx === "number") {
        if (typeof realtimeFailedAt === "number") {
          // 失敗が確定している場合、全て赤
          isFail = true;
        } else if (realtimeSuccess) {
          isSuccess = true; // 全成功確定
        } else if (p.failed) {
          isFail = true;
        }
      } else {
        isFail = Boolean(p.failed);
        isSuccess = !Boolean(p.failed);
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
