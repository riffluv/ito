import { buildSubmitClueUpdate } from "@/lib/server/roomCommandsSubmitClue/helpers";

describe("roomCommandsSubmitClue helpers", () => {
  test("buildSubmitClueUpdate sets clue1, ready true, lastSeen", () => {
    const ts = Symbol("ts");
    expect(buildSubmitClueUpdate({ clue: "c", lastSeen: ts })).toEqual({
      clue1: "c",
      ready: true,
      lastSeen: ts,
    });
  });
});

