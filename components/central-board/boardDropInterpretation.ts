export type BoardBounds = { left: number; right: number; bottom: number };

export type BoardPoint = { x: number; y: number };

export type BoardDropDecision =
  | {
      kind: "ignore";
      reason: "same-target" | "unhandled" | "slot-index-invalid";
    }
  | {
      kind: "invalid";
      reason: "no-over" | "target-not-found";
    }
  | {
      kind: "return";
      via: "zone" | "fallback";
      allowed: true;
    }
  | {
      kind: "return";
      via: "zone" | "fallback";
      allowed: false;
      reason: "notPlaced" | "notOwner";
    }
  | {
      kind: "slot";
      operation: "add" | "move";
      slotIndex: number;
      originalSlotIndex: number;
      maxSlots: number;
      clamped: boolean;
    }
  | {
      kind: "move-to-card";
      targetIndex: number;
    };

export function interpretBoardDrop(params: {
  activePlayerId: string;
  meId: string;
  overId: string | null;
  isSameTarget: boolean;
  boardProposal: (string | null | undefined)[];
  pending: (string | null | undefined)[];
  slotCountDragging: number;
  hasOverRect: boolean;
  boardBounds: BoardBounds | null;
  lastDragPosition: BoardPoint | null;
  returnDropZoneId: string;
}): BoardDropDecision {
  const alreadyInProposal = params.boardProposal.includes(params.activePlayerId);
  const isPendingOnly =
    !alreadyInProposal && params.pending.includes(params.activePlayerId);
  const alreadyPlaced = alreadyInProposal || isPendingOnly;

  const overId = params.overId;
  const isSlotTarget = Boolean(overId && overId.startsWith("slot-"));
  const isReturnTarget = overId === params.returnDropZoneId;

  const boardBounds = params.boardBounds;
  const lastPosition = params.lastDragPosition;
  const fallbackReturn =
    !isReturnTarget &&
    !isSlotTarget &&
    alreadyPlaced &&
    Boolean(boardBounds) &&
    Boolean(lastPosition) &&
    (lastPosition?.y ?? 0) >= (boardBounds?.bottom ?? 0) + 6 &&
    (lastPosition?.x ?? 0) >= (boardBounds?.left ?? 0) - 16 &&
    (lastPosition?.x ?? 0) <= (boardBounds?.right ?? 0) + 16;

  if (isReturnTarget || fallbackReturn) {
    const via = isReturnTarget ? "zone" : "fallback";
    if (!alreadyPlaced) {
      return { kind: "return", via, allowed: false, reason: "notPlaced" };
    }
    if (params.activePlayerId !== params.meId) {
      return { kind: "return", via, allowed: false, reason: "notOwner" };
    }
    return { kind: "return", via, allowed: true };
  }

  if (overId === null) {
    return { kind: "invalid", reason: "no-over" };
  }

  if (params.isSameTarget) {
    return { kind: "ignore", reason: "same-target" };
  }

  if (overId.startsWith("slot-") && params.hasOverRect) {
    const parsed = parseInt(overId.split("-")[1], 10);
    if (Number.isNaN(parsed)) {
      return { kind: "ignore", reason: "slot-index-invalid" };
    }
    const maxSlots = Math.max(0, params.slotCountDragging - 1);
    const slotIndex = Math.min(Math.max(0, parsed), maxSlots);
    return {
      kind: "slot",
      operation: alreadyInProposal ? "move" : "add",
      slotIndex,
      originalSlotIndex: parsed,
      maxSlots,
      clamped: slotIndex !== parsed,
    };
  }

  if (!alreadyInProposal) {
    return { kind: "ignore", reason: "unhandled" };
  }

  const targetIndex = params.boardProposal.indexOf(overId);
  if (targetIndex < 0) {
    return { kind: "invalid", reason: "target-not-found" };
  }
  return { kind: "move-to-card", targetIndex };
}
