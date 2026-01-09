type CountSnapshotData = { count?: number };

export function readAggregateCount(snapshot: { data(): CountSnapshotData | undefined }): number {
  const data = snapshot.data();
  const value = data?.count;
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}
