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
  state: "default" | "success" | "fail" | "ready"; // coloring state
  boundary?: boolean; // marks the card right before failure for subtle emphasis
  successLevel?: "mild" | "final"; // refine success into per-card mild vs final celebration
  clueText: string | null; // clue to show (may be placeholder)
  number: number | null; // numeric value or null if hidden
  revealed: boolean; // whether the card is considered revealed in game logic
  waitingInCentral: boolean; // whether this card is waiting in central area (Dragon Quest style)
}

// Consolidated logic for sort-submit mode only (sequential mode removed).
export function computeCardState(p: ComputeCardStateParams): ComputedCardState {
  // ---------- Helpers (pure, local) ----------
  const idx = p.idx;
  const number = p.player?.number ?? null;
  const clue1 = p.player?.clue1 ?? "";

  const isPlaced = (): boolean =>
    !!(
      (p.orderList && p.orderList.includes(p.id)) ||
      p.pending.includes(p.id) ||
      (p.proposal && p.proposal.includes(p.id))
    );

  const isRevealedIdx = (): boolean =>
    typeof idx === "number" &&
    (p.roomStatus === "finished" ||
      (p.roomStatus === "reveal" && idx < p.revealIndex));

  const computeShowNumber = (): boolean => {
    const placed = isPlaced();
    if (p.roomStatus === "reveal" && p.revealAnimating) {
      if (typeof idx === "number" && idx < p.revealIndex) {
        return typeof number === "number" && placed;
      }
      return false;
    }
    if (p.roomStatus === "finished") {
      return typeof number === "number" && placed;
    }
    return false;
  };

  const variant: ComputedCardState["variant"] =
    p.roomStatus === "reveal" || p.roomStatus === "finished" ? "flip" : "flat";

  const computeFlipped = (showNumber: boolean): boolean => {
    if (variant !== "flip") return false;
    if (showNumber) return true; // 数値を見せるタイミング
    if (p.roomStatus === "finished" && isPlaced()) return true; // 終了時は数値面
    return false;
  };

  const rt = p.realtimeResult ?? null;
  const hasRT = rt !== null;
  const rtFailedAt = hasRT ? rt!.failedAt : null;
  const rtJudgedUpTo = hasRT ? (rt!.currentIndex ?? 0) : 0;
  const rtSuccess = hasRT ? rt!.success === true : false;

  const shouldApplyRevealColor = (): boolean =>
    p.roomStatus === "reveal" &&
    p.revealIndex >= 2 &&
    hasRT &&
    typeof idx === "number";

  const computeColorState = (
    showNumber: boolean,
    flipped: boolean,
    revealed: boolean
  ): {
    isFail: boolean;
    isSuccess: boolean;
    successLevel?: ComputedCardState["successLevel"];
  } => {
    // 裏面で色を出すのは避ける（従来の抑制）
    const allow = flipped || showNumber || p.roomStatus === "finished";
    if (!allow || !revealed) return { isFail: false, isSuccess: false };

    let isFail = false;
    let isSuccess = false;
    let successLevel: ComputedCardState["successLevel"] | undefined;

    if (p.roomStatus === "reveal") {
      if (shouldApplyRevealColor()) {
        if (typeof rtFailedAt === "number") {
          // 失敗: 現在まで(=rtJudgedUpTo)は全て赤
          if ((idx as number) + 1 <= rtJudgedUpTo) isFail = true;
        } else if (rtSuccess && rtFailedAt === null) {
          // 成功継続: failedAtがnullの場合のみ緑色
          if ((idx as number) + 1 <= rtJudgedUpTo) isSuccess = true;
        }
      }
    } else if (p.roomStatus === "finished") {
      if (hasRT && typeof idx === "number") {
        if (typeof rtFailedAt === "number") {
          isFail = true; // 失敗確定は全て赤
        } else if (rtSuccess && rtFailedAt === null) {
          isSuccess = true; // 全成功確定（failedAtがnullの場合のみ）
        } else if (p.failed) {
          isFail = true; // サーバ確定フォールバック
        }
      } else {
        // realtimeResultがない場合のフォールバック（安全側に倒す）
        isFail = Boolean(p.failed);
        isSuccess = !Boolean(p.failed);
      }
    }

    if (isSuccess) successLevel = "final";
    return { isFail, isSuccess, successLevel };
  };

  const showNumber = computeShowNumber();
  const flipped = computeFlipped(showNumber);
  const revealed = isRevealedIdx();
  const { isFail, isSuccess, successLevel } = computeColorState(
    showNumber,
    flipped,
    revealed
  );

  const boundary =
    typeof idx === "number" &&
    typeof p.boundaryPreviousIndex === "number" &&
    idx === p.boundaryPreviousIndex;

  const clueText =
    p.roomStatus !== "finished" ? clue1 || "(連想待ち)" : clue1 || null;

  const waitingInCentral = true; // Dragon Quest style always-on
  
  // 連想ワード確定済みかどうか（空でない文字列があるかチェック）
  const hasClue = !!(clue1 && clue1.trim() !== "");

  return {
    showNumber,
    variant,
    flipped,
    state: isFail ? "fail" : isSuccess ? "success" : hasClue ? "ready" : "default",
    boundary,
    successLevel,
    clueText,
    number: showNumber && typeof number === "number" ? number : null,
    revealed,
    waitingInCentral,
  };
}
