import {
  buildTopicCustomRoomUpdates,
  buildTopicResetRoomUpdates,
  buildTopicSelectOrShuffleRoomUpdates,
  deriveTopicTypeFromAction,
  selectTopicPool,
  validateTopicTypeForAction,
} from "@/lib/server/roomCommandsTopic/helpers";

describe("roomCommandsTopic helpers", () => {
  const sections = {
    normal: ["n1"],
    rainbow: ["r1"],
    classic: ["c1"],
  } as any;

  test("deriveTopicTypeFromAction returns type only for select/shuffle", () => {
    expect(deriveTopicTypeFromAction({ kind: "select", type: "通常版" as any })).toBe("通常版");
    expect(deriveTopicTypeFromAction({ kind: "shuffle", type: "レインボー版" as any })).toBe("レインボー版");
    expect(deriveTopicTypeFromAction({ kind: "shuffle", type: null } as any)).toBeNull();
    expect(deriveTopicTypeFromAction({ kind: "custom", text: "x" } as any)).toBeNull();
  });

  test("validateTopicTypeForAction matches current error rules", () => {
    expect(validateTopicTypeForAction({ action: { kind: "select", type: "通常版" as any }, topicType: null })).toBe(
      "invalid_topic_type"
    );
    expect(validateTopicTypeForAction({ action: { kind: "shuffle", type: null } as any, topicType: null })).toBe(
      "missing_topic_type"
    );
    expect(validateTopicTypeForAction({ action: { kind: "shuffle", type: "通常版" as any }, topicType: "通常版" as any })).toBe(
      "ok"
    );
  });

  test("selectTopicPool selects section by topicType", () => {
    expect(selectTopicPool(sections, "通常版" as any)).toEqual(["n1"]);
    expect(selectTopicPool(sections, "レインボー版" as any)).toEqual(["r1"]);
    expect(selectTopicPool(sections, "クラシック版" as any)).toEqual(["c1"]);
    expect(selectTopicPool(sections, null)).toEqual([]);
  });

  test("buildTopicResetRoomUpdates matches payload keys", () => {
    const ts = Symbol("ts");
    const updates = buildTopicResetRoomUpdates({ serverNow: ts });
    expect(updates).toMatchObject({
      status: "waiting",
      result: null,
      deal: null,
      order: null,
      round: 0,
      topic: null,
      topicOptions: null,
      topicBox: null,
      closedAt: null,
      expiresAt: null,
      lastActiveAt: ts,
    });
  });

  test("buildTopicCustomRoomUpdates sets custom topic fields", () => {
    const ts = Symbol("ts");
    expect(buildTopicCustomRoomUpdates({ topic: "hello", serverNow: ts })).toEqual({
      topic: "hello",
      topicBox: "カスタム",
      topicOptions: null,
      lastActiveAt: ts,
    });
  });

  test("buildTopicSelectOrShuffleRoomUpdates sets topicBox/topic/lastActiveAt and clears options", () => {
    const ts = Symbol("ts");
    expect(buildTopicSelectOrShuffleRoomUpdates({ topicBox: "通常版" as any, topic: "t", serverNow: ts })).toEqual({
      topicBox: "通常版",
      topicOptions: null,
      topic: "t",
      lastActiveAt: ts,
    });
  });
});

