jest.mock("@/lib/firebase/client", () => ({
  db: null,
}));

jest.mock("@/lib/utils/broadcast", () => ({
  postRoundReset: jest.fn(),
}));

jest.mock("@/lib/game/service", () => ({
  resetRoomWithPrune: jest.fn(),
  submitSortedOrder: jest.fn(),
  topicControls: { setCustomTopic: jest.fn() },
}));

jest.mock("@/lib/services/roomApiClient", () => ({
  apiStartGame: jest.fn(),
  apiNextRound: jest.fn(),
}));

jest.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: null }),
}));

import { createHostActionsController } from "@/lib/host/HostActionsController";
import { resetRoomWithPrune } from "@/lib/game/service";
import { apiStartGame } from "@/lib/services/roomApiClient";

describe("HostActionsController retry", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  test("resetRoomToWaitingWithPrune retries on transient network error with same requestId", async () => {
    jest.useFakeTimers();
    const resetMock = resetRoomWithPrune as unknown as jest.Mock;
    resetMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(undefined);

    const controller = createHostActionsController({
      getSessionId: () => "session-123",
    });

    const promise = controller.resetRoomToWaitingWithPrune({
      roomId: "room-1",
      roundIds: [],
      onlineUids: [],
      includeOnline: false,
      recallSpectators: true,
    });

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(700);
    await promise;

    expect(resetMock).toHaveBeenCalledTimes(2);
    const requestIds = resetMock.mock.calls.map((call) => call[2]?.requestId);
    expect(requestIds[0]).toBeTruthy();
    expect(requestIds[0]).toBe(requestIds[1]);
  });

  test("quickStartWithTopic retries on transient network error with same requestId", async () => {
    jest.useFakeTimers();
    const startMock = apiStartGame as unknown as jest.Mock;
    startMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(undefined);

    const controller = createHostActionsController({
      getSessionId: () => "session-123",
    });

    const promise = controller.quickStartWithTopic({
      roomId: "room-1",
      defaultTopicType: "通常版",
      roomStatus: "waiting",
      presenceInfo: { presenceReady: true, onlineUids: ["u1", "u2"], playerCount: 2 },
      currentTopic: null,
      customTopic: null,
      allowFromFinished: false,
      allowFromClue: false,
    });

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(700);
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(startMock).toHaveBeenCalledTimes(2);
    const requestIds = startMock.mock.calls.map((call) => call[1]?.requestId);
    expect(requestIds[0]).toBeTruthy();
    expect(requestIds[0]).toBe(requestIds[1]);
  });
});
