import { act, renderHook } from "@testing-library/react";
import type { DragEndEvent } from "@dnd-kit/core";

import { useBoardDragEndHandler } from "@/components/central-board/useBoardDragEndHandler";

jest.mock("@/components/ui/notify", () => ({
  notify: jest.fn(),
}));

describe("useBoardDragEndHandler cleanup", () => {
  it("clears active state even when activeId state is null", () => {
    const clearActive = jest.fn();
    const endDropSession = jest.fn();
    const cancelPendingDragMove = jest.fn();
    const updateDropAnimationTarget = jest.fn();
    const enqueueMagnetUpdate = jest.fn();
    const playDropInvalid = jest.fn();

    const { result } = renderHook(() =>
      useBoardDragEndHandler({
        activeId: null,
        resolveMode: "sort-submit",
        roomStatus: "clue",
        roomId: "room-1",
        meId: "p1",
        boardProposal: [null],
        pendingRef: { current: [null] },
        slotCountDragging: 1,
        boardContainerRef: { current: null },
        lastDragPositionRef: { current: null },
        cursorSnapOffset: null,
        magnetConfigRef: { current: {} },
        getProjectedMagnetState: () => ({ dx: 0, dy: 0, strength: 0, distance: 0, shouldSnap: false }),
        enqueueMagnetUpdate,
        updateDropAnimationTarget,
        clearActive,
        cancelPendingDragMove,
        endDropSession,
        playDropInvalid,
        playCardPlace: jest.fn(),
        returnCardToWaiting: jest.fn(async () => true),
        onOptimisticProposalChange: jest.fn(),
        updatePendingState: jest.fn(),
        scheduleDropRollback: jest.fn(),
        clearDropRollbackTimer: jest.fn(),
        clearOptimisticProposal: jest.fn(),
        setOptimisticReturningIds: jest.fn(),
        applyOptimisticReorder: jest.fn(),
      })
    );

    const event = {
      active: {
        id: "p1",
        rect: {
          current: {
            initial: { left: 0, top: 0, width: 100, height: 160 },
          },
        },
      },
      over: null,
      delta: { x: 0, y: 0 },
    } as unknown as DragEndEvent;

    act(() => {
      result.current(event);
    });

    expect(cancelPendingDragMove).toHaveBeenCalledTimes(1);
    expect(playDropInvalid).toHaveBeenCalledTimes(0);
    expect(clearActive).toHaveBeenCalledTimes(1);
    expect(endDropSession).toHaveBeenCalledTimes(1);
    expect(enqueueMagnetUpdate).toHaveBeenCalledTimes(1);
    expect(updateDropAnimationTarget).toHaveBeenCalled();
  });
});
