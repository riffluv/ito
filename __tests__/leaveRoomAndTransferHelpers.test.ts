import {
  collectSnapshotReferenceIds,
  pruneLeaveDedupeEntries,
  retainOrderSnapshots,
} from "@/lib/server/roomActions/leaveRoomAndTransfer/helpers";

describe("leaveRoomAndTransfer helpers", () => {
  test("collectSnapshotReferenceIds trims and ignores empty values", () => {
    const ids = collectSnapshotReferenceIds({
      list: [" a ", "", "b", "  ", "c"],
      proposal: ["b", null, " d "],
    } as any);
    expect(Array.from(ids).sort()).toEqual(["a", "b", "c", "d"]);
  });

  test("retainOrderSnapshots keeps only referenced ids and trims to maxRetained from the front", () => {
    const out = retainOrderSnapshots({
      snapshots: {
        a: { name: "A" } as any,
        b: { name: "B" } as any,
        c: { name: "C" } as any,
      },
      referenceIds: new Set(["b", "c"]),
      maxRetained: 1,
    });
    expect(out).toEqual({ c: { name: "C" } });
  });

  test("retainOrderSnapshots returns null when none referenced", () => {
    const out = retainOrderSnapshots({
      snapshots: { a: { name: "A" } as any },
      referenceIds: new Set(["x"]),
      maxRetained: 10,
    });
    expect(out).toBeNull();
  });

  test("pruneLeaveDedupeEntries prunes old entries and computes skip window", () => {
    const now = 10_000;
    const { entries, skipNotification } = pruneLeaveDedupeEntries({
      rawEntries: { u1: now - 1_000, old: now - 999_999 },
      now,
      pruneMs: 60_000,
      windowMs: 4_000,
      userId: "u1",
    });
    expect(skipNotification).toBe(true);
    expect(entries.old).toBeUndefined();
    expect(entries.u1).toBe(now);
  });

  test("pruneLeaveDedupeEntries does not skip when outside window", () => {
    const now = 10_000;
    const { skipNotification } = pruneLeaveDedupeEntries({
      rawEntries: { u1: now - 10_000 },
      now,
      pruneMs: 60_000,
      windowMs: 4_000,
      userId: "u1",
    });
    expect(skipNotification).toBe(false);
  });
});

