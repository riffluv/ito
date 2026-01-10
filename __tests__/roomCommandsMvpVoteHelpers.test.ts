import { buildMvpVoteUpdates } from "@/lib/server/roomCommandsMvpVote/helpers";

describe("roomCommandsMvpVote helpers", () => {
  test("buildMvpVoteUpdates sets mvpVotes.uid and lastActiveAt", () => {
    const ts = Symbol("ts");
    const del = Symbol("del");
    expect(buildMvpVoteUpdates({ uid: "u1", targetId: "t1", lastActiveAt: ts, fieldDelete: del })).toEqual({
      lastActiveAt: ts,
      "mvpVotes.u1": "t1",
    });
    expect(buildMvpVoteUpdates({ uid: "u1", targetId: null, lastActiveAt: ts, fieldDelete: del })).toEqual({
      lastActiveAt: ts,
      "mvpVotes.u1": del,
    });
  });
});

