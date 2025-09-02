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
  sequentialFlippedIds?: Set<string>; // 順次モード用の正確なフリップ状態
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
}

// Consolidated logic extracted from legacy CardRenderer for clarity.
export function computeCardState(p: ComputeCardStateParams): ComputedCardState {
  const modeSort = p.resolveMode === "sort-submit";
  const idx = p.idx;
  const number = p.player?.number ?? null;
  const clue1 = p.player?.clue1 ?? "";
  const isPlaced = !!(
    (p.orderList && p.orderList.includes(p.id)) ||
    p.pending.includes(p.id) ||
    (p.proposal && p.proposal.includes(p.id))
  );

  // 1) Number visibility
  // Strategy:
  // - sort-submit: original timing (only during reveal anim show progressively, always in finished)
  // - sequential: if using flip variant, showNumber == flipped; if not using flip variant keep previous progressive gating.
  let showNumber = false;
  if (modeSort) {
    if (p.roomStatus === "reveal" && p.revealAnimating) {
      if (typeof idx === "number" && idx < p.revealIndex) {
        showNumber = typeof number === "number" && isPlaced;
      }
    } else if (p.roomStatus === "finished") {
      showNumber = typeof number === "number" && isPlaced;
    }
  } else {
    if (p.sequentialFlip) {
      // Will align with flipped later after flipped computed; temporary placeholder, set to false here and override after flipped calculation.
      // (We can't compute flipped yet because it depends on variant which depends on this flag; we'll patch after flipped computation.)
    } else if (typeof idx === "number" && idx < p.revealIndex) {
      showNumber = typeof number === "number" && isPlaced;
    }
  }

  // 2) Failure / success computation
  const effectiveFailedAt = p.localFailedAt ?? p.failedAt;
  const flipPhaseReached = typeof idx === "number" && idx < p.revealIndex;
  const revealed = modeSort
    ? typeof idx === "number" &&
      (p.roomStatus === "finished" ||
        (p.roomStatus === "reveal" && idx < p.revealIndex))
    : isPlaced;
  const failureConfirmed = (() => {
    if (typeof effectiveFailedAt !== "number") return false;
    if (modeSort) {
      if (p.roomStatus === "finished") return !!p.failed;
      return p.revealIndex >= effectiveFailedAt;
    }
    // sequential: 失敗確定はフリップ完了後のみ（順次モードの適切なタイミング）
    return flipPhaseReached; // フリップが完了したカードのみ失敗状態を表示
  })();

  let isFail = false;
  let isSuccess = false;
  let successLevel: ComputedCardState["successLevel"] = undefined;
  let boundary = false;

  if (modeSort) {
    const active = p.roomStatus === "finished" || flipPhaseReached;
    isFail =
      revealed &&
      active &&
      typeof effectiveFailedAt === "number" &&
      typeof idx === "number" &&
      idx === effectiveFailedAt - 1;
    isSuccess =
      revealed && active && !failureConfirmed && p.roomStatus === "finished";
    if (isSuccess) successLevel = "final";
  } else if (typeof idx === "number") {
    const failingCard =
      typeof effectiveFailedAt === "number" && idx === effectiveFailedAt - 1;
    if (flipPhaseReached) {
      if (failingCard) {
        isFail = true;
      } else if (typeof effectiveFailedAt !== "number") {
        // 成功状態は、フリップ完了 + ゲーム終了後のみ表示
        if (p.roomStatus === "finished") {
          isSuccess = true;
          successLevel = "final";
        }
        // フリップ中は状態を表示しない（デフォルト状態維持）
      }
    }
    if (
      typeof p.boundaryPreviousIndex === "number" &&
      idx === p.boundaryPreviousIndex
    ) {
      boundary = true;
    }
    // finished状態での最終成功判定（重複だが安全のため保持）
    if (p.roomStatus === "finished" && !failureConfirmed && flipPhaseReached) {
      isSuccess = true;
      successLevel = "final";
    }
  }

  // 3) Variant & flip state
  const variant: ComputedCardState["variant"] = (() => {
    if (modeSort && (p.roomStatus === "reveal" || p.roomStatus === "finished"))
      return "flip";
    if (!modeSort && p.sequentialFlip) return "flip";
    return "flat";
  })();
  const flipped = (() => {
    if (variant !== "flip") return false;
    if (modeSort) {
      // finished では revealIndex が途中で finalizeReveal されたクライアントでも
      // 最終的に全カードが数値面を向く必要がある（ホスト以外の遅延対策）。
      if (p.roomStatus === "finished") {
        return true; // orderList に含まれない番兵は render されない前提
      }
      return (
        typeof idx === "number" &&
        p.roomStatus === "reveal" &&
        idx < p.revealIndex
      );
    }
    if (!modeSort && p.sequentialFlip) {
      if (typeof idx !== "number") return false;
      // sequentialFlippedIds が利用可能なら、それを使用して正確なフリップ状態を判定
      if (p.sequentialFlippedIds) {
        return p.sequentialFlippedIds.has(p.id);
      }
      // 失敗時（finished）で sequentialFlippedIds が無い場合は、
      // 進行中アニメーションを尊重して false を返す（即座にフリップしない）
      if (p.roomStatus === "finished" && (p.failed || p.localFailedAt !== null)) {
        return false; // 失敗時は進行中のアニメーションを継続
      }
      // フォールバック: 旧ロジック（revealIndexベース）- 成功時のみ
      return idx < p.revealIndex; // when its index passed, flip stays
    }
    return false;
  })();

  // 4) Clue text
  const clueText =
    modeSort && p.roomStatus !== "finished"
      ? clue1 || "(連想待ち)"
      : clue1 || null;

  // If sequential flip: override showNumber with flipped
  if (!modeSort && p.sequentialFlip) {
    showNumber = flipped && typeof number === "number" && isPlaced;
  }

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
