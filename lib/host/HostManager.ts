export type HostPlayerInput = {
  id: string | null | undefined;
  joinedAt?: number | null;
  orderIndex?: number | null;
  lastSeenAt?: number | null;
  isOnline?: boolean | null;
  name?: string | null;
};

export type HostManagerContext = {
  roomId: string;
  currentHostId?: string | null;
  players: HostPlayerInput[];
  leavingUid?: string | null;
};

export type HostDecisionReason =
  | "host-present"
  | "claim-success"
  | "auto-assign"
  | "host-left"
  | "no-players";

export type HostDecision =
  | { action: "none"; reason: "host-present"; hostId: string | null }
  | { action: "assign"; reason: "claim-success" | "auto-assign" | "host-left"; hostId: string }
  | { action: "clear"; reason: "no-players" };

type HostPlayer = {
  id: string;
  joinedAt: number;
  orderIndex: number;
  lastSeenAt: number;
  isOnline: boolean;
  name?: string | null;
};

function buildNormalizedPlayers(
  inputs: HostPlayerInput[],
  leavingUid: string
): { players: HostPlayer[]; byId: Map<string, HostPlayer> } {
  const players: HostPlayer[] = [];
  const byId = new Map<string, HostPlayer>();

  for (const raw of inputs) {
    const id = normalizeId(raw?.id ?? null);
    if (!id) continue;
    if (id === leavingUid) continue;
    if (byId.has(id)) {
      const existing = byId.get(id)!;
      existing.joinedAt = Math.min(
        existing.joinedAt,
        toTimestamp(raw?.joinedAt ?? null)
      );
      existing.orderIndex = Math.min(
        existing.orderIndex,
        toOrderIndex(raw?.orderIndex ?? null)
      );
      existing.lastSeenAt = Math.min(
        existing.lastSeenAt,
        toTimestamp(raw?.lastSeenAt ?? null)
      );
      existing.isOnline = existing.isOnline || !!raw?.isOnline;
      if (!existing.name && raw?.name) existing.name = raw.name;
      continue;
    }
    const player: HostPlayer = {
      id,
      joinedAt: toTimestamp(raw?.joinedAt ?? null),
      orderIndex: toOrderIndex(raw?.orderIndex ?? null),
      lastSeenAt: toTimestamp(raw?.lastSeenAt ?? null),
      isOnline: !!raw?.isOnline,
      name: raw?.name ?? null,
    };
    byId.set(id, player);
    players.push(player);
  }

  players.sort((a, b) => {
    if (a.isOnline !== b.isOnline) {
      return a.isOnline ? -1 : 1;
    }
    if (a.joinedAt !== b.joinedAt) {
      return a.joinedAt - b.joinedAt;
    }
    if (a.orderIndex !== b.orderIndex) {
      return a.orderIndex - b.orderIndex;
    }
    if (a.lastSeenAt !== b.lastSeenAt) {
      return a.lastSeenAt - b.lastSeenAt;
    }
    return a.id.localeCompare(b.id);
  });

  return { players, byId };
}
function normalizeId(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

function toTimestamp(value: number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return Number.MAX_SAFE_INTEGER;
}

function toOrderIndex(value: number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return Number.MAX_SAFE_INTEGER;
}

export function selectHostCandidate(
  inputs: HostPlayerInput[],
  opts?: { leavingUid?: string | null }
): string | null {
  const leavingUid = normalizeId(opts?.leavingUid ?? null);
  const { players } = buildNormalizedPlayers(inputs, leavingUid);
  return players[0]?.id ?? null;
}

export class HostManager {
  private readonly roomId: string;
  private readonly currentHostId: string;
  private readonly leavingUid: string;
  private readonly playersById: Map<string, HostPlayer>;
  private readonly orderedPlayers: HostPlayer[];

  constructor(context: HostManagerContext) {
    this.roomId = context.roomId;
    this.currentHostId = normalizeId(context.currentHostId ?? null);
    this.leavingUid = normalizeId(context.leavingUid ?? null);

    const leavingUid = this.leavingUid;
    const { players, byId } = buildNormalizedPlayers(context.players, leavingUid);

    this.playersById = byId;
    this.orderedPlayers = players;
  }

  private hasValidHost(): boolean {
    if (!this.currentHostId) return false;
    if (this.currentHostId === this.leavingUid) return false;
    return this.playersById.has(this.currentHostId);
  }

  private resolvePrimaryCandidate(): HostPlayer | null {
    if (this.orderedPlayers.length === 0) return null;
    return this.orderedPlayers[0] ?? null;
  }

  evaluateClaim(claimantId: string | null | undefined): HostDecision {
    const claimant = normalizeId(claimantId ?? null);
    if (this.hasValidHost()) {
      return { action: "none", reason: "host-present", hostId: this.currentHostId };
    }

    const primary = this.resolvePrimaryCandidate();
    if (!primary) {
      return { action: "clear", reason: "no-players" };
    }

    const reason: HostDecisionReason = claimant && claimant === primary.id ? "claim-success" : "auto-assign";
    return { action: "assign", reason, hostId: primary.id };
  }

  evaluateAfterLeave(): HostDecision {
    if (this.hasValidHost()) {
      return { action: "none", reason: "host-present", hostId: this.currentHostId };
    }

    const primary = this.resolvePrimaryCandidate();
    if (!primary) {
      return { action: "clear", reason: "no-players" };
    }

    return { action: "assign", reason: "host-left", hostId: primary.id };
  }

  getPlayerMeta(hostId: string): { name?: string | null } | null {
    const player = this.playersById.get(normalizeId(hostId));
    if (!player) return null;
    return { name: player.name };
  }
}

export function buildHostPlayerInputsFromSnapshots<T extends { id: string }>(options: {
  docs: T[];
  getJoinedAt: (doc: T) => number | null | undefined;
  getOrderIndex?: (doc: T) => number | null | undefined;
  getLastSeenAt?: (doc: T) => number | null | undefined;
  onlineIds?: Set<string> | string[] | null;
  getName?: (doc: T) => string | null | undefined;
}): HostPlayerInput[] {
  const onlineSet = Array.isArray(options.onlineIds)
    ? new Set(options.onlineIds.map((id) => normalizeId(id)))
    : options.onlineIds instanceof Set
    ? new Set(Array.from(options.onlineIds).map((id) => normalizeId(id)))
    : new Set<string>();

  return options.docs.map((doc) => {
    const id = normalizeId(doc.id);
    return {
      id,
      joinedAt: options.getJoinedAt(doc),
      orderIndex: options.getOrderIndex ? options.getOrderIndex(doc) : null,
      lastSeenAt: options.getLastSeenAt ? options.getLastSeenAt(doc) : null,
      isOnline: onlineSet.has(id),
      name: options.getName ? options.getName(doc) : null,
    };
  });
}
