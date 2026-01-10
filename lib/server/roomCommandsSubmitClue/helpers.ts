export function buildSubmitClueUpdate(params: {
  clue: string;
  lastSeen: unknown;
}): Record<string, unknown> {
  return {
    clue1: params.clue,
    ready: true,
    lastSeen: params.lastSeen,
  };
}

