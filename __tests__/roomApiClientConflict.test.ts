jest.mock("@/lib/firebase/client", () => ({
  auth: {
    currentUser: {
      getIdToken: jest.fn().mockResolvedValue("token"),
    },
  },
}));

import { apiStartGame } from "@/lib/services/roomApiClient";

describe("roomApiClient conflict recovery", () => {
  test("dispatches room resync events on 409 invalid_status", async () => {
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");
    const originalFetch = global.fetch;

    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: "invalid_status" }),
    })) as unknown as typeof fetch;

    try {
      await expect(apiStartGame("room-123", { requestId: "request-123" })).rejects.toBeInstanceOf(
        Error
      );
      const types = dispatchSpy.mock.calls.map(([event]) => (event as Event).type);
      expect(types).toContain("ito:room-force-refresh");
      expect(types).toContain("ito:room-restart-listener");
    } finally {
      dispatchSpy.mockRestore();
      global.fetch = originalFetch;
    }
  });
});

