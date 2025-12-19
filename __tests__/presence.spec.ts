import { PRESENCE_STALE_MS } from "@/lib/constants/presence";
import { isPresenceConnectionActive } from "@/lib/presence";

const buildPresenceSet = (
  map: Record<string, Record<string, { ts: number; online?: boolean }>>,
  now: number
) =>
  Object.keys(map).filter((uid) => {
    const conns = map[uid] || {};
    return Object.values(conns).some((conn) =>
      isPresenceConnectionActive(conn, now)
    );
  });

describe("presence authority logic", () => {
  const now = 1_000_000;

  test("keeps host online for momentary disconnects", () => {
    const activeTs = now - 5_000;
    expect(
      isPresenceConnectionActive({ online: true, ts: activeTs }, now)
    ).toBe(true);
  });

  test("marks host offline when explicitly flagged", () => {
    const offlineAt = now - (PRESENCE_STALE_MS * 2 + 1);
    expect(
      isPresenceConnectionActive(
        { online: false, ts: now - 10_000, offlineAt },
        now
      )
    ).toBe(false);
  });

  test("treats stale heartbeat as offline even if still flagged online", () => {
    const staleTs = now - PRESENCE_STALE_MS * 10;
    expect(
      isPresenceConnectionActive({ online: true, ts: staleTs }, now)
    ).toBe(false);
  });

  test("retains host when at least one tab stays fresh", () => {
    const presence = {
      host: {
        stale: { online: true, ts: now - (PRESENCE_STALE_MS + 10_000) },
        fresh: { online: true, ts: now - 2_000 },
      },
      guest: {
        primary: { online: true, ts: now - 3_000 },
      },
    };
    const online = buildPresenceSet(presence, now);
    expect(online).toContain("host");
    expect(online).toContain("guest");
  });
});
