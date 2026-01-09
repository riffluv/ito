import {
  filterPresenceUids,
  isTransientNetworkError,
  normalizeTopicType,
} from "@/lib/host/hostActionsControllerHelpers";

describe("hostActionsControllerHelpers", () => {
  describe("filterPresenceUids", () => {
    test("returns undefined for empty inputs", () => {
      expect(filterPresenceUids(undefined)).toBeUndefined();
      expect(filterPresenceUids(null)).toBeUndefined();
      expect(filterPresenceUids([])).toBeUndefined();
      expect(filterPresenceUids([null, undefined, ""])).toBeUndefined();
    });

    test("filters out blank and non-string ids", () => {
      expect(filterPresenceUids(["a", " ", "b", null] as any)).toEqual(["a", "b"]);
    });
  });

  describe("normalizeTopicType", () => {
    test("falls back to default for null/empty", () => {
      expect(normalizeTopicType(undefined)).toBe("通常版");
      expect(normalizeTopicType(null)).toBe("通常版");
      expect(normalizeTopicType("")).toBe("通常版");
      expect(normalizeTopicType("   ")).toBe("通常版");
    });

    test("returns trimmed string", () => {
      expect(normalizeTopicType("  カスタム ")).toBe("カスタム");
    });
  });

  describe("isTransientNetworkError", () => {
    test("treats ApiError with numeric status as non-transient", () => {
      expect(isTransientNetworkError({ status: 503 } as any)).toBe(false);
    });

    test("treats timeout code as transient", () => {
      expect(isTransientNetworkError({ code: "timeout" } as any)).toBe(true);
    });

    test("treats typical fetch/network messages as transient", () => {
      expect(isTransientNetworkError(new Error("Failed to fetch"))).toBe(true);
      expect(isTransientNetworkError(new TypeError("NetworkError"))).toBe(true);
      expect(isTransientNetworkError(new Error("Load failed"))).toBe(true);
    });

    test("treats other errors as non-transient", () => {
      expect(isTransientNetworkError(new Error("boom"))).toBe(false);
    });
  });
});

