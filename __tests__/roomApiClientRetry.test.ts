jest.mock("@/lib/firebase/client", () => ({
  auth: {
    currentUser: {
      getIdToken: jest.fn().mockResolvedValue("token"),
    },
  },
}));

import { apiMutateProposal } from "@/lib/services/roomApiClient";

describe("roomApiClient retry", () => {
  test("apiMutateProposal retries on network failure", async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      await apiMutateProposal({
        roomId: "room-1",
        playerId: "player-1",
        action: "add",
        targetIndex: 0,
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
