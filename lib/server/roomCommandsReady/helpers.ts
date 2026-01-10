export function buildReadyUpdate(params: {
  ready: boolean;
  lastSeen: unknown;
}): Record<string, unknown> {
  return { ready: params.ready, lastSeen: params.lastSeen };
}

