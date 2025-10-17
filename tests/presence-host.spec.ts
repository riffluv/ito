import { test, expect } from "@playwright/test";
import {
  HostManager,
  buildHostPlayerInputsFromSnapshots,
} from "../lib/host/HostManager";
import { PRESENCE_STALE_MS } from "../lib/constants/presence";
import { isPresenceConnectionActive } from "../lib/presence";

type MockDoc = {
  id: string;
  createTime: { toMillis(): number };
  data(): { orderIndex?: number; name?: string | null };
};

const createDoc = (
  id: string,
  joinedAt: number,
  orderIndex: number,
  name: string
): MockDoc => ({
  id,
  createTime: { toMillis: () => joinedAt },
  data: () => ({ orderIndex, name }),
});

const onlineFromPresence = (
  presence: Record<string, Record<string, { ts: number; online?: boolean }>>,
  now: number
) =>
  Object.keys(presence).filter((uid) => {
    const conns = presence[uid] || {};
    return Object.values(conns).some((conn) =>
      isPresenceConnectionActive(conn, now)
    );
  });

const buildManager = (
  presence: Record<string, Record<string, { ts: number; online?: boolean }>>,
  docs: MockDoc[],
  now: number
) => {
  const onlineIds = onlineFromPresence(presence, now);
  const inputs = buildHostPlayerInputsFromSnapshots({
    docs,
    getJoinedAt: (doc) => doc.createTime.toMillis(),
    getOrderIndex: (doc) => doc.data().orderIndex ?? null,
    getName: (doc) => doc.data().name ?? null,
    onlineIds,
  });
  return new HostManager({
    roomId: "room-1",
    currentHostId: "host",
    players: inputs,
  });
};

test("host remains assigned after a short disconnect", () => {
  const now = 1_000_000;
  const presence = {
    host: { conn: { online: true, ts: now - 5_000 } },
    guest: { conn: { online: true, ts: now - 3_000 } },
  };
  const docs = [
    createDoc("host", now - 10_000, 0, "Host"),
    createDoc("guest", now - 9_000, 1, "Guest"),
  ];
  const manager = buildManager(presence, docs, now);
  const decision = manager.evaluateClaim("guest");
  expect(decision.action).toBe("none");
});

test("host is reassigned after exceeding stale threshold", () => {
  const now = 2_000_000;
  const presence = {
    host: {
      conn: { online: true, ts: now - (PRESENCE_STALE_MS + 10_000) },
    },
    guest: { conn: { online: true, ts: now - 2_000 } },
  };
  // simulate host pruning removing the stale host doc
  const docs = [createDoc("guest", now - 9_000, 0, "Guest")];
  const manager = buildManager(presence, docs, now);
  const decision = manager.evaluateClaim("guest");
  expect(decision.action).toBe("assign");
  if (decision.action === "assign") {
    expect(decision.hostId).toBe("guest");
  }
});

test("latest tab keeps host active despite stale duplicates", () => {
  const now = 3_000_000;
  const presence = {
    host: {
      stale: {
        online: true,
        ts: now - (PRESENCE_STALE_MS + 20_000),
      },
      fresh: { online: true, ts: now - 1_000 },
    },
    guest: { conn: { online: true, ts: now - 4_000 } },
  };
  const docs = [
    createDoc("host", now - 15_000, 0, "Host"),
    createDoc("guest", now - 12_000, 1, "Guest"),
  ];
  const manager = buildManager(presence, docs, now);
  const decision = manager.evaluateClaim("guest");
  expect(decision.action).toBe("none");
});
