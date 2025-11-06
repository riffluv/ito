import { act, renderHook, waitFor } from "@testing-library/react";

import { useSpectatorSession } from "@/lib/spectator/v2/useSpectatorSession";
import type { SpectatorRejoinSource } from "@/lib/spectator/v2";

function createMockServices() {
  const listeners: { rejoin?: (snapshot: any) => void } = {};

  const consumeInvite = jest.fn(async () => ({
    sessionId: "session-1",
    mode: "private" as const,
    inviteId: "invite-1",
  }));
  const startWatching = jest.fn(async () => {});
  const requestRejoin = jest.fn(async () => {});
  const cancelRejoin = jest.fn(async () => {});
  const endSession = jest.fn(async () => {});
  const approveRejoin = jest.fn(async () => {});
  const rejectRejoin = jest.fn(async () => {});
  const observeRejoinSnapshot = jest.fn(
    ({
      onSnapshot,
    }: {
      sessionId: string;
      roomId: string;
      onSnapshot: (snapshot: any) => void;
      onError: (error: unknown) => void;
    }) => {
      listeners.rejoin = onSnapshot;
      return () => {
        listeners.rejoin = undefined;
      };
    }
  );

  return {
    consumeInvite,
    startWatching,
    requestRejoin,
    cancelRejoin,
    endSession,
    approveRejoin,
    rejectRejoin,
    observeRejoinSnapshot,
    listeners,
  };
}

describe("useSpectatorSession", () => {
  test("approveRejoin delegates to service with current room", async () => {
    const services = createMockServices();
    const { result } = renderHook(() =>
      useSpectatorSession({
        roomId: "room-approve",
        viewerUid: "viewer-1",
        services,
        manualRejoinObservation: true,
      })
    );

    await waitFor(() => expect(result.current.is.ready).toBe(true), { timeout: 2000 });

    await act(async () => {
      await result.current.actions.approveRejoin("session-approve");
    });

    expect(services.approveRejoin).toHaveBeenCalledWith({
      sessionId: "session-approve",
      roomId: "room-approve",
    });
  });

  test("rejectRejoin passes reason to service", async () => {
    const services = createMockServices();
    const { result } = renderHook(() =>
      useSpectatorSession({
        roomId: "room-reject",
        viewerUid: "viewer-2",
        services,
        manualRejoinObservation: true,
      })
    );

    await waitFor(() => expect(result.current.is.ready).toBe(true), { timeout: 2000 });

    await act(async () => {
      await result.current.actions.rejectRejoin("session-reject", "room-full");
    });

    expect(services.rejectRejoin).toHaveBeenCalledWith({
      sessionId: "session-reject",
      roomId: "room-reject",
      reason: "room-full",
    });
  });

});
