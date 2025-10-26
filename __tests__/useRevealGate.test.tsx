import { act, renderHook, waitFor } from "@testing-library/react";

import { useRevealGate } from "@/lib/hooks/useRevealGate";

describe("useRevealGate", () => {
  test("end clears pending state after manual begin failure", () => {
    const { result } = renderHook(() => useRevealGate("clue", "room-offline"));

    act(() => {
      result.current.begin();
    });
    expect(result.current.hideHandUI).toBe(true);

    act(() => {
      result.current.end();
    });
    expect(result.current.hideHandUI).toBe(false);
  });

  test("status transition to reveal clears pending state automatically", async () => {
    const hook = renderHook(
      ({ status }) => useRevealGate(status, "room-transition"),
      { initialProps: { status: "clue" as string | null | undefined } }
    );

    act(() => {
      hook.result.current.begin();
    });
    expect(hook.result.current.hideHandUI).toBe(true);

    hook.rerender({ status: "reveal" });
    await waitFor(() => {
      expect(hook.result.current.pending).toBe(false);
    });
    expect(hook.result.current.hideHandUI).toBe(true);
  });
});
