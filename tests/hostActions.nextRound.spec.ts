import { test, expect } from "@playwright/test";
import { createHostActionsController } from "../lib/host/HostActionsController";
import type { NextRoundResult } from "../lib/services/roomApiClient";

test.describe("nextRound API 競合ガード", () => {
  test("同時に2回叩いても requestId が分離される（サーバーロックで1回分に収束させる前提）", async () => {
    const calls: Array<{ roomId: string; requestId: string | undefined }> = [];
    const mockApiNextRound = async (
      roomId: string,
      opts: {
        topicType?: string | null;
        customTopic?: string | null;
        requestId: string;
        sessionId?: string | null;
        presenceUids?: string[] | null;
      }
    ): Promise<NextRoundResult> => {
      calls.push({ roomId, requestId: opts.requestId });
      return {
        ok: true,
        round: 1,
        playerCount: 2,
        topic: null,
        topicType: opts.topicType ?? null,
      };
    };

    const controller = createHostActionsController(
      {
        getSessionId: () => "sess-mock",
      },
      { apiNextRound: mockApiNextRound }
    );

    await Promise.all([
      controller.nextRound({ roomId: "room-req", topicType: "通常版" }),
      controller.nextRound({ roomId: "room-req", topicType: "通常版" }),
    ]);

    expect(calls).toHaveLength(2);
    expect(new Set(calls.map((c) => c.requestId)).size).toBe(2);
    calls.forEach((c) => expect(c.roomId).toBe("room-req"));
  });
});
