import {
  buildStartFailureTrace,
  buildStartLockHolder,
  buildStartLockedTrace,
  buildStartRoundPreparingUpdate,
  normalizeStartGameFlags,
} from "@/lib/server/roomCommandsStartGame/helpers";

describe("roomCommandsStartGame helpers", () => {
  test("normalizeStartGameFlags defaults to false and autoDeal strict true", () => {
    expect(normalizeStartGameFlags({})).toEqual({
      allowFromFinished: false,
      allowFromClue: false,
      doAutoDeal: false,
    });
    expect(normalizeStartGameFlags({ allowFromFinished: true, allowFromClue: true, autoDeal: true })).toEqual({
      allowFromFinished: true,
      allowFromClue: true,
      doAutoDeal: true,
    });
    expect(normalizeStartGameFlags({ autoDeal: false })).toEqual({
      allowFromFinished: false,
      allowFromClue: false,
      doAutoDeal: false,
    });
  });

  test("buildStartLockHolder prefixes requestId", () => {
    expect(buildStartLockHolder("abc")).toBe("start:abc");
  });

  test("buildStartLockedTrace contains expected fields", () => {
    expect(buildStartLockedTrace({ roomId: "r1", requestId: "q1", holder: "start:q1" })).toEqual({
      roomId: "r1",
      requestId: "q1",
      holder: "start:q1",
    });
  });

  test("buildStartRoundPreparingUpdate sets ui.roundPreparing and lastActiveAt", () => {
    const ts = Symbol("ts");
    expect(buildStartRoundPreparingUpdate({ fieldServerTimestamp: ts })).toEqual({
      "ui.roundPreparing": true,
      lastActiveAt: ts,
    });
  });

  test("buildStartFailureTrace maps room fields and locked flag", () => {
    const trace = buildStartFailureTrace({
      roomId: "r1",
      requestId: "q1",
      prevStatus: "waiting" as any,
      failureRoom: { status: "clue", ui: { roundPreparing: true }, startRequestId: "s1" } as any,
      locked: true,
    });
    expect(trace).toEqual({
      roomId: "r1",
      requestId: "q1",
      prevStatus: "waiting",
      status: "clue",
      roundPreparing: true,
      startRequestId: "s1",
      locked: "1",
    });
  });
});

