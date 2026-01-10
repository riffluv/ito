export function buildRoomOptionsUpdates(params: {
  resolveMode?: string | null;
  defaultTopicType?: string | null;
  serverNow: unknown;
}): Record<string, unknown> {
  const updates: Record<string, unknown> = { lastActiveAt: params.serverNow };
  if (params.resolveMode) {
    updates["options.resolveMode"] = params.resolveMode;
  }
  if (params.defaultTopicType) {
    updates["options.defaultTopicType"] = params.defaultTopicType;
  }
  return updates;
}

