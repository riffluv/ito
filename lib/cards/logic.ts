// Centralized pure functions for card presentation & animation state.
// This allows UI components to stay lean and declarative.
// Sequential mode has been removed - only sort-submit mode is supported.
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
  failedAt?: number | null; // server confirmed failure index (1-based)
  localFailedAt?: number | null; // client-only provisional failure index (1-based)
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

  // 2) Failure / success computation - リアルタイム判定優先
  // リアルタイム結果がある場合はそれを優先、なければ従来のロジック
  const effectiveFailedAt = p.realtimeResult?.failedAt ?? p.localFailedAt ?? p.failedAt;
  const effectiveFailed = p.realtimeResult ? !p.realtimeResult.success : p.failed;
  
  const flipPhaseReached = typeof idx === "number" && idx < p.revealIndex;
  const revealed =
    typeof idx === "number" &&
    (p.roomStatus === "finished" ||
      (p.roomStatus === "reveal" && idx < p.revealIndex));

  const failureConfirmed = (() => {
    if (typeof effectiveFailedAt !== "number") return false;
    if (p.roomStatus === "finished") return !!effectiveFailed;
    // リアルタイム判定の場合: 該当カードがめくられた時点で失敗確定
    if (p.realtimeResult && !p.realtimeResult.success) {
      return p.revealIndex >= effectiveFailedAt;
    }
    return p.revealIndex >= effectiveFailedAt;
  })();

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
    isFail =
      revealed &&
      active &&
      typeof effectiveFailedAt === "number" &&
      typeof idx === "number" &&
      idx === effectiveFailedAt - 1;
    // Only show success (blue) if game succeeded and not failed specifically
    isSuccess =
      revealed && active && p.roomStatus === "finished" && !isFail && !effectiveFailed; // リアルタイム結果を考慮
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
