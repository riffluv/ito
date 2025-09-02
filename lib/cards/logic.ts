// Centralized pure functions for card presentation & animation state.
// This allows UI components to stay lean and declarative.
import type { PlayerDoc } from "@/lib/types";

export type ResolveMode = "sequential" | "sort-submit" | string | undefined;
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
  // sequential flip support
  sequentialFlip?: boolean; // enable flip style also for sequential mode
}

export interface ComputedCardState {
  showNumber: boolean; // whether numeric value should be rendered
  variant: "flat" | "flip"; // which card visual to use
  flipped: boolean; // for flip variant: whether backside (number) is shown
  state: "default" | "success" | "fail"; // coloring state
  boundary?: boolean; // marks the card right before failure for subtle emphasis
  clueText: string | null; // clue to show (may be placeholder)
  number: number | null; // numeric value or null if hidden
  revealed: boolean; // whether the card is considered revealed in game logic
}

// Consolidated logic extracted from legacy CardRenderer for clarity.
export function computeCardState(p: ComputeCardStateParams): ComputedCardState {
  const {
    player,
    id,
    idx,
    orderList,
    pending,
    proposal,
    resolveMode,
    roomStatus,
    revealIndex,
    revealAnimating,
    failed,
    failedAt,
    localFailedAt,
    boundaryPreviousIndex,
    sequentialFlip,
  } = p;

  const number = player?.number ?? null;
  const clue1 = player?.clue1 ?? "";

  const isPlaced = !!(
    (orderList && orderList.includes(id)) ||
    pending.includes(id) ||
    (proposal && proposal.includes(id))
  );

  const modeSort = resolveMode === "sort-submit";

  // Reveal + number visibility rules
  // sort-submit: base is placed numeric
  // sequential: base hidden (flip later)
  let showNumber = modeSort ? typeof number === "number" && isPlaced : false;
  if (modeSort) {
    if (roomStatus === "finished") {
      showNumber = typeof number === "number" && isPlaced;
    } else if (
      roomStatus === "reveal" &&
      revealAnimating &&
      typeof idx === "number"
    ) {
      showNumber = typeof number === "number" && isPlaced && idx < revealIndex;
    } else {
      showNumber = false; // hide while only placed
    }
  } else {
    // sequential mode: once revealIndex passes idx, number stays visible even after animation flag drops
    if (typeof idx === "number" && idx < revealIndex) {
      showNumber = true;
    } else if (revealAnimating && typeof idx === "number") {
      showNumber = idx < revealIndex;
    }
  }

  const effectiveFailedAt = localFailedAt ?? failedAt;
  const failureConfirmed = (() => {
    if (typeof effectiveFailedAt !== "number") return false;
    if (modeSort) {
      if (roomStatus === "finished") return !!failed;
      return revealIndex >= effectiveFailedAt;
    }
    return true;
  })();

  const revealed = modeSort
    ? typeof idx === "number" &&
      (roomStatus === "finished" ||
        (roomStatus === "reveal" && idx < revealIndex))
    : isPlaced;

  // Timing for coloring:
  //   sort-submit -> color per-card once that card has flipped OR when finished.
  //   sequential  -> defer all coloring until the overall sequence finishes (requested UX),
  //                  so no early mass red flash between flips.
  const flipPhaseReached = typeof idx === "number" && idx < revealIndex;
  let isFail = false;
  let isSuccess = false;
  let boundary = false;

  if (modeSort) {
    const coloringActive = roomStatus === "finished" || flipPhaseReached;
    isFail =
      revealed &&
      coloringActive &&
      typeof effectiveFailedAt === "number" &&
      typeof idx === "number" &&
      idx === effectiveFailedAt - 1;
    isSuccess =
      revealed &&
      coloringActive &&
      !failureConfirmed &&
      roomStatus === "finished";
  } else {
    // sequential per optimal spec:
    // - show fail immediately on failing card flip
    // - show subtle success (state 'success') per flipped correct card (not final strong) until finished
    // - boundary highlight for card before failing pair
    if (typeof idx === "number") {
      const flippedNow = flipPhaseReached; // idx < revealIndex
      const failingCard =
        typeof effectiveFailedAt === "number" && idx === effectiveFailedAt - 1;
      if (flippedNow) {
        if (failingCard) {
          isFail = true;
        } else if (typeof effectiveFailedAt !== "number") {
          // only apply mild success if no failure yet
          isSuccess = true;
        }
      }
      if (
        typeof boundaryPreviousIndex === "number" &&
        idx === boundaryPreviousIndex
      ) {
        boundary = true;
      }
      // After overall finish and success (no failure), keep success state (already true)
      if (roomStatus === "finished" && !failureConfirmed) {
        isSuccess = true;
      }
      // After finish with failure, keep failing card red, others default
    }
  }

  // Variant / flipping
  const variant: ComputedCardState["variant"] = (() => {
    if (modeSort && (roomStatus === "reveal" || roomStatus === "finished"))
      return "flip";
    if (!modeSort && sequentialFlip) return "flip";
    return "flat";
  })();
  const flipped = (() => {
    if (variant !== "flip") return false;
    if (modeSort) {
      return (
        typeof idx === "number" &&
        (roomStatus === "reveal" || roomStatus === "finished") &&
        idx < revealIndex
      );
    }
    // sequential flip: use revealIndex as progressive counter
    if (!modeSort && sequentialFlip) {
      if (typeof idx !== "number") return false;
      // Keep flipped once it has flipped (revealIndex already advanced beyond idx)
      return idx < revealIndex;
    }
    return false;
  })();

  // Clue placeholder logic
  const clueText =
    modeSort && roomStatus !== "finished"
      ? clue1 || "(連想待ち)"
      : clue1 || null;

  return {
    showNumber,
    variant,
    flipped,
    state: isFail ? "fail" : isSuccess ? "success" : "default",
    boundary,
    clueText,
    number: showNumber && typeof number === "number" ? number : null,
    revealed,
  };
}

// Helper to progressively add reveal to sequential mode
export function computeSequentialFlip(
  revealAnimating: boolean,
  idx: number | undefined,
  revealIndex: number
) {
  if (!revealAnimating) return false;
  if (typeof idx !== "number") return false;
  return idx < revealIndex;
}
