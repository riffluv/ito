import { interpretBoardDrop } from "@/components/central-board/boardDropInterpretation";

describe("interpretBoardDrop", () => {
  const base = {
    activePlayerId: "p1",
    meId: "p1",
    overId: null as string | null,
    isSameTarget: false,
    boardProposal: [] as (string | null)[],
    pending: [] as (string | null)[],
    slotCountDragging: 4,
    hasOverRect: true,
    boardBounds: null as { left: number; right: number; bottom: number } | null,
    lastDragPosition: null as { x: number; y: number } | null,
    returnDropZoneId: "waiting-return-zone",
  };

  it("returns fallback return when dropped below board", () => {
    const decision = interpretBoardDrop({
      ...base,
      boardProposal: ["p1"],
      boardBounds: { left: 0, right: 100, bottom: 100 },
      lastDragPosition: { x: 50, y: 106 },
    });
    expect(decision).toEqual({ kind: "return", via: "fallback", allowed: true });
  });

  it("denies return when not placed", () => {
    const decision = interpretBoardDrop({
      ...base,
      overId: "waiting-return-zone",
    });
    expect(decision).toEqual({
      kind: "return",
      via: "zone",
      allowed: false,
      reason: "notPlaced",
    });
  });

  it("denies return when card is not mine", () => {
    const decision = interpretBoardDrop({
      ...base,
      activePlayerId: "p2",
      meId: "p1",
      overId: "waiting-return-zone",
      boardProposal: ["p2"],
    });
    expect(decision).toEqual({
      kind: "return",
      via: "zone",
      allowed: false,
      reason: "notOwner",
    });
  });

  it("returns invalid no-over when no target and no fallback return", () => {
    const decision = interpretBoardDrop({
      ...base,
      boardBounds: { left: 0, right: 100, bottom: 100 },
      lastDragPosition: { x: 50, y: 104 },
    });
    expect(decision).toEqual({ kind: "invalid", reason: "no-over" });
  });

  it("returns slot decision with clamped index", () => {
    const decision = interpretBoardDrop({
      ...base,
      overId: "slot-10",
      slotCountDragging: 5,
      hasOverRect: true,
    });
    expect(decision).toEqual({
      kind: "slot",
      operation: "add",
      slotIndex: 4,
      originalSlotIndex: 10,
      maxSlots: 4,
      clamped: true,
    });
  });

  it("ignores slot drop when slot index is invalid", () => {
    const decision = interpretBoardDrop({
      ...base,
      overId: "slot-foo",
      hasOverRect: true,
    });
    expect(decision).toEqual({ kind: "ignore", reason: "slot-index-invalid" });
  });

  it("returns move-to-card for placed card dropped onto another card", () => {
    const decision = interpretBoardDrop({
      ...base,
      activePlayerId: "p2",
      meId: "p1",
      overId: "p3",
      boardProposal: ["p2", null, "p3"],
    });
    expect(decision).toEqual({ kind: "move-to-card", targetIndex: 2 });
  });
});

