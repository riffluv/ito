import { shouldReassignHost } from "@/lib/host/hostRules";

describe("shouldReassignHost", () => {
  test("returns false when current host remains after another player leaves", () => {
    const result = shouldReassignHost({
      currentHostId: "host-1",
      leavingUid: "guest-1",
      remainingIds: ["host-1", "guest-2"],
    });
    expect(result).toBe(false);
  });

  test("returns true when the host leaves but other players remain", () => {
    const result = shouldReassignHost({
      currentHostId: "host-1",
      leavingUid: "host-1",
      remainingIds: ["guest-2", "guest-3"],
    });
    expect(result).toBe(true);
  });

  test("returns true when the recorded host is missing from remaining players", () => {
    const result = shouldReassignHost({
      currentHostId: "host-1",
      leavingUid: "guest-2",
      remainingIds: ["guest-2", "guest-3"],
    });
    expect(result).toBe(true);
  });

  test("returns false when no players remain to assume host duties", () => {
    const result = shouldReassignHost({
      currentHostId: "host-1",
      leavingUid: "host-1",
      remainingIds: [],
    });
    expect(result).toBe(false);
  });

  test("returns true when there is no current host but players remain", () => {
    const result = shouldReassignHost({
      currentHostId: null,
      leavingUid: "guest-1",
      remainingIds: ["guest-1", "guest-2"],
    });
    expect(result).toBe(true);
  });
});
