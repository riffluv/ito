import { jest } from "@jest/globals";
import {
  getResultSoundState,
  playResultSound,
  resetResultSoundState,
} from "@/lib/audio/resultSound";

jest.mock("@/lib/audio/global", () => {
  const waitForSoundReady = jest.fn();
  const getGlobalSoundManager = jest.fn();
  return {
    __esModule: true,
    waitForSoundReady,
    getGlobalSoundManager,
  };
});

type MockManager = {
  play: jest.Mock<Promise<void>, [string]>;
  prepareForInteraction: jest.Mock<Promise<void>, []>;
  markUserInteraction: jest.Mock<void, []>;
  getSettings: jest.Mock<{ successMode: "normal" | "epic" }, []>;
};

const mockedAudioGlobal = jest.requireMock("@/lib/audio/global") as {
  waitForSoundReady: jest.Mock;
  getGlobalSoundManager: jest.Mock;
};

describe("playResultSound", () => {
  let manager: MockManager;

  beforeEach(() => {
    jest.useFakeTimers();
    manager = {
      play: jest.fn().mockResolvedValue(undefined),
      prepareForInteraction: jest.fn().mockResolvedValue(undefined),
      markUserInteraction: jest.fn(),
      getSettings: jest.fn().mockReturnValue({ successMode: "normal" }),
    };
    mockedAudioGlobal.waitForSoundReady.mockReset();
    mockedAudioGlobal.getGlobalSoundManager.mockReset();
    resetResultSoundState();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("awaits ready gate then plays once for victory", async () => {
    mockedAudioGlobal.waitForSoundReady.mockResolvedValue({
      manager,
      ready: true,
      timedOut: false,
    });

    await playResultSound({ outcome: "victory" });

    expect(mockedAudioGlobal.waitForSoundReady).toHaveBeenCalled();
    expect(manager.play).toHaveBeenCalledTimes(1);
    expect(manager.play).toHaveBeenCalledWith("clear_success1");
  });

  test("dedupes when a pending playback exists", async () => {
    mockedAudioGlobal.waitForSoundReady.mockResolvedValue({
      manager,
      ready: true,
      timedOut: false,
    });

    // schedule delayed playback
    void playResultSound({ outcome: "victory", delayMs: 200 });
    // call again while pending
    await playResultSound({ outcome: "victory", delayMs: 0, skipIfPending: true });

    const state = getResultSoundState();
    expect(state.pendingOutcome).toBe("victory");
    expect(manager.play).not.toHaveBeenCalled();

    // flush timer and ensure single play
    await jest.runOnlyPendingTimersAsync();
    await Promise.resolve();

    expect(manager.play).toHaveBeenCalledTimes(1);
  });

  test("falls back to global manager when ready waits out", async () => {
    mockedAudioGlobal.waitForSoundReady.mockResolvedValue({
      manager: null,
      ready: false,
      timedOut: true,
    });
    mockedAudioGlobal.getGlobalSoundManager.mockReturnValue(manager);

    await playResultSound({ outcome: "failure", readyTimeoutMs: 10 });

    expect(manager.play).toHaveBeenCalledWith("clear_failure");
  });

  test("victory と failure を連続で呼んでも各1回ずつ鳴る", async () => {
    mockedAudioGlobal.waitForSoundReady.mockResolvedValue({
      manager,
      ready: true,
      timedOut: false,
    });

    await playResultSound({ outcome: "victory" });
    await playResultSound({ outcome: "failure", delayMs: 40 });

    await jest.runOnlyPendingTimersAsync();

    expect(manager.play).toHaveBeenCalledTimes(2);
    expect(manager.play).toHaveBeenNthCalledWith(1, "clear_success1");
    expect(manager.play).toHaveBeenNthCalledWith(2, "clear_failure");
  });
});
