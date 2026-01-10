import {
  computeDedupeDeletes,
  deriveCreatorUpdates,
  filterCanonicalPlayers,
  findPlayerDocByUid,
  isPlayerRegistered,
  resolveEffectiveHostId,
  shouldKeepExistingHost,
  trimOrNull,
} from "@/lib/server/roomActions/ensureHostAssignedServer/helpers";

describe("ensureHostAssignedServer helpers", () => {
  test("trimOrNull normalizes strings", () => {
    expect(trimOrNull(null)).toBeNull();
    expect(trimOrNull("")).toBeNull();
    expect(trimOrNull("  ")).toBeNull();
    expect(trimOrNull(" a ")).toBe("a");
  });

  test("deriveCreatorUpdates sets creatorId/name from host when creatorId missing", () => {
    const del = Symbol("delete");
    expect(
      deriveCreatorUpdates({
        existingCreatorId: null,
        existingCreatorName: null,
        currentHostId: "h1",
        roomHostName: "Host",
        fieldDelete: del,
      })
    ).toEqual({ creatorId: "h1", creatorName: "Host" });

    expect(
      deriveCreatorUpdates({
        existingCreatorId: null,
        existingCreatorName: null,
        currentHostId: "h1",
        roomHostName: null,
        fieldDelete: del,
      })
    ).toEqual({ creatorId: "h1", creatorName: del });

    // creatorName already set => don't delete/override when hostName missing
    expect(
      deriveCreatorUpdates({
        existingCreatorId: null,
        existingCreatorName: "Creator",
        currentHostId: "h1",
        roomHostName: null,
        fieldDelete: del,
      })
    ).toEqual({ creatorId: "h1" });
  });

  test("isPlayerRegistered matches by doc id or data.uid", () => {
    const docs = [
      { id: "a", data: () => ({ uid: "u1" } as any) },
      { id: "b", data: () => ({ uid: "u2" } as any) },
    ];
    expect(isPlayerRegistered(docs, "b")).toBe(true);
    expect(isPlayerRegistered(docs, "u1")).toBe(true);
    expect(isPlayerRegistered(docs, "nope")).toBe(false);
    expect(isPlayerRegistered(docs, null)).toBe(false);
  });

  test("findPlayerDocByUid prefers id match then data.uid match", () => {
    const docs = [
      { id: "doc1", data: () => ({ uid: "u1" } as any) },
      { id: "u2", data: () => ({ uid: "u2" } as any) },
    ];
    expect(findPlayerDocByUid(docs, "u2")?.id).toBe("u2");
    expect(findPlayerDocByUid(docs, "u1")?.id).toBe("doc1");
    expect(findPlayerDocByUid(docs, "nope")).toBeNull();
  });

  test("computeDedupeDeletes removes same uid docs and doc.id==uid except keepDocId", () => {
    const docs = [
      { id: "keep", data: () => ({ uid: "u1" } as any) },
      { id: "u1", data: () => ({ uid: "u1" } as any) },
      { id: "other", data: () => ({ uid: "u1" } as any) },
      { id: "ok", data: () => ({ uid: "u2" } as any) },
    ];
    const deletes = computeDedupeDeletes({ playerDocs: docs, uid: "u1", keepDocId: "keep" }).sort();
    expect(deletes).toEqual(["other", "u1"]);
  });

  test("filterCanonicalPlayers removes delete ids", () => {
    const docs = [
      { id: "a", data: () => ({ uid: "u1" } as any) },
      { id: "b", data: () => ({ uid: "u2" } as any) },
    ];
    const canonical = filterCanonicalPlayers({ playerDocs: docs, deleteDocIds: new Set(["b"]) });
    expect(canonical.map((d) => d.id)).toEqual(["a"]);
  });

  test("shouldKeepExistingHost matches current rule", () => {
    expect(
      shouldKeepExistingHost({
        currentHostId: "h1",
        uid: "u1",
        hostStillRegistered: true,
        hostOnline: true,
      })
    ).toBe(true);
    expect(
      shouldKeepExistingHost({
        currentHostId: "h1",
        uid: "h1",
        hostStillRegistered: true,
        hostOnline: true,
      })
    ).toBe(false);
  });

  test("resolveEffectiveHostId returns host only when registered and online", () => {
    expect(
      resolveEffectiveHostId({
        currentHostId: "h1",
        hostStillRegistered: true,
        hostOnline: true,
      })
    ).toBe("h1");
    expect(
      resolveEffectiveHostId({
        currentHostId: "h1",
        hostStillRegistered: false,
        hostOnline: true,
      })
    ).toBeNull();
  });
});

