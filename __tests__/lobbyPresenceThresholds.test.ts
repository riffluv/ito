import {
  DEFAULT_ACCEPT_FRESH_MS,
  DEFAULT_LOBBY_STALE_MS,
  computeLobbyStaleMs,
  computeZeroFreezeMsDefault,
  parseEnvBooleanFlag,
  parseEnvNumber,
} from "@/lib/hooks/lobbyCounts/presenceThresholds";

describe("lobby presence thresholds", () => {
  test("parseEnvBooleanFlag supports 1/true variants", () => {
    expect(parseEnvBooleanFlag(undefined)).toBe(false);
    expect(parseEnvBooleanFlag("")).toBe(false);
    expect(parseEnvBooleanFlag("0")).toBe(false);
    expect(parseEnvBooleanFlag("false")).toBe(false);
    expect(parseEnvBooleanFlag("1")).toBe(true);
    expect(parseEnvBooleanFlag("true")).toBe(true);
    expect(parseEnvBooleanFlag(" TRUE ")).toBe(true);
  });

  test("parseEnvNumber returns null for empty/invalid", () => {
    expect(parseEnvNumber(undefined)).toBeNull();
    expect(parseEnvNumber("")).toBeNull();
    expect(parseEnvNumber("  ")).toBeNull();
    expect(parseEnvNumber("nope")).toBeNull();
    expect(parseEnvNumber("NaN")).toBeNull();
  });

  test("parseEnvNumber parses finite numbers", () => {
    expect(parseEnvNumber("0")).toBe(0);
    expect(parseEnvNumber("123")).toBe(123);
    expect(parseEnvNumber(" 45 ")).toBe(45);
  });

  test("computeLobbyStaleMs uses default when env is null/<=0 and clamps by presenceStaleMs", () => {
    expect(
      computeLobbyStaleMs({
        envStaleMs: null,
        presenceStaleMs: 60_000,
        heartbeatMs: 10_000,
      })
    ).toBe(Math.min(60_000, Math.max(15_000, DEFAULT_LOBBY_STALE_MS)));

    expect(
      computeLobbyStaleMs({
        envStaleMs: 0,
        presenceStaleMs: 60_000,
        heartbeatMs: 10_000,
      })
    ).toBe(Math.min(60_000, Math.max(15_000, DEFAULT_LOBBY_STALE_MS)));

    expect(
      computeLobbyStaleMs({
        envStaleMs: 100_000,
        presenceStaleMs: 40_000,
        heartbeatMs: 10_000,
      })
    ).toBe(40_000);
  });

  test("computeLobbyStaleMs enforces minimum heartbeat+5s", () => {
    expect(
      computeLobbyStaleMs({
        envStaleMs: 8_000,
        presenceStaleMs: 60_000,
        heartbeatMs: 10_000,
      })
    ).toBe(15_000);
  });

  test("computeZeroFreezeMsDefault uses env when provided else max(20s, stale+5s)", () => {
    expect(
      computeZeroFreezeMsDefault({
        envZeroFreezeMs: 12_345,
        lobbyStaleMs: 40_000,
      })
    ).toBe(12_345);

    expect(
      computeZeroFreezeMsDefault({
        envZeroFreezeMs: null,
        lobbyStaleMs: 10_000,
      })
    ).toBe(20_000);

    expect(
      computeZeroFreezeMsDefault({
        envZeroFreezeMs: null,
        lobbyStaleMs: 40_000,
      })
    ).toBe(45_000);
  });

  test("DEFAULT_ACCEPT_FRESH_MS is 5s", () => {
    expect(DEFAULT_ACCEPT_FRESH_MS).toBe(5_000);
  });
});

