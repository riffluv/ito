import {
  filterPresenceUids,
  mapNextRoundFailureReason,
} from "@/lib/host/nextRound/helpers";

describe("nextRound helpers", () => {
  test("filterPresenceUids filters invalid ids and returns undefined for empty", () => {
    expect(filterPresenceUids(undefined)).toBeUndefined();
    expect(filterPresenceUids(null)).toBeUndefined();
    expect(filterPresenceUids([])).toBeUndefined();
    expect(filterPresenceUids([null, undefined, ""])).toBeUndefined();
    expect(filterPresenceUids(["a", " ", "b", null])).toEqual(["a", "b"]);
  });

  test("mapNextRoundFailureReason maps error codes to public reasons", () => {
    expect(mapNextRoundFailureReason("forbidden")).toBe("forbidden");
    expect(mapNextRoundFailureReason("rate_limited")).toBe("rate-limited");
    expect(mapNextRoundFailureReason("invalid_status")).toBe("invalid_status");
    expect(mapNextRoundFailureReason("no_players")).toBe("no_players");
    expect(mapNextRoundFailureReason(undefined)).toBe("api-error");
    expect(mapNextRoundFailureReason(null)).toBe("api-error");
    expect(mapNextRoundFailureReason("other")).toBe("api-error");
  });
});

