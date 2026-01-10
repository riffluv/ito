export function buildRevealPendingUpdates(params: {
  pending: boolean;
  activeAt: unknown;
  beginAt: unknown;
  fieldDelete: unknown;
}): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    "ui.revealPending": params.pending,
    lastActiveAt: params.activeAt,
  };
  updates["ui.revealBeginAt"] = params.pending ? params.beginAt : params.fieldDelete;
  return updates;
}

