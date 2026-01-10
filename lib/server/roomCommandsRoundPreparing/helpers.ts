export function buildRoundPreparingUpdate(params: {
  active: boolean;
  lastActiveAt: unknown;
}): Record<string, unknown> {
  return {
    "ui.roundPreparing": params.active,
    lastActiveAt: params.lastActiveAt,
  };
}

