export function buildMvpVoteUpdates(params: {
  uid: string;
  targetId: string | null;
  lastActiveAt: unknown;
  fieldDelete: unknown;
}): Record<string, unknown> {
  const fieldPath = `mvpVotes.${params.uid}`;
  const updates: Record<string, unknown> = { lastActiveAt: params.lastActiveAt };
  updates[fieldPath] = params.targetId ? params.targetId : params.fieldDelete;
  return updates;
}

