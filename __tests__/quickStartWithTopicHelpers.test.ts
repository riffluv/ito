import {
  buildQuickStartValidStatuses,
  filterPresenceUids,
  isHostMismatch,
  needsCustomTopic,
} from "@/lib/host/quickStartWithTopic/helpers";

describe("quickStartWithTopic helpers", () => {
  test("buildQuickStartValidStatuses expands allowed statuses", () => {
    expect(
      buildQuickStartValidStatuses({ allowFromFinished: false, allowFromClue: false })
    ).toEqual(["waiting"]);
    expect(
      buildQuickStartValidStatuses({ allowFromFinished: true, allowFromClue: false })
    ).toEqual(["waiting", "reveal", "finished"]);
    expect(
      buildQuickStartValidStatuses({ allowFromFinished: false, allowFromClue: true })
    ).toEqual(["waiting", "clue"]);
    expect(
      buildQuickStartValidStatuses({ allowFromFinished: true, allowFromClue: true })
    ).toEqual(["waiting", "reveal", "finished", "clue"]);
  });

  test("filterPresenceUids returns undefined for empty/unset and filters invalid", () => {
    expect(filterPresenceUids(undefined)).toBeUndefined();
    expect(filterPresenceUids(null)).toBeUndefined();
    expect(filterPresenceUids([])).toBeUndefined();
    expect(filterPresenceUids([null, undefined, ""])).toBeUndefined();
    expect(filterPresenceUids([" a ", "b", "", null])).toEqual([" a ", "b"]);
  });

  test("needsCustomTopic returns true only when type is custom and topics are empty", () => {
    expect(needsCustomTopic({ topicType: "通常版", customTopic: "", topic: "" })).toBe(false);
    expect(needsCustomTopic({ topicType: "カスタム", customTopic: "x", topic: null })).toBe(false);
    expect(needsCustomTopic({ topicType: "カスタム", customTopic: null, topic: "y" })).toBe(false);
    expect(needsCustomTopic({ topicType: "カスタム", customTopic: "   ", topic: "  " })).toBe(true);
  });

  test("isHostMismatch matches hostId vs authUid", () => {
    expect(isHostMismatch({ roomHostId: null, authUid: "a" })).toBe(false);
    expect(isHostMismatch({ roomHostId: "a", authUid: null })).toBe(false);
    expect(isHostMismatch({ roomHostId: "a", authUid: "a" })).toBe(false);
    expect(isHostMismatch({ roomHostId: "a", authUid: "b" })).toBe(true);
  });
});

