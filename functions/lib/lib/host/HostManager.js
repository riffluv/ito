"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostManager = void 0;
exports.selectHostCandidate = selectHostCandidate;
exports.buildHostPlayerInputsFromSnapshots = buildHostPlayerInputsFromSnapshots;
function buildNormalizedPlayers(inputs, leavingUid) {
    const players = [];
    const byId = new Map();
    for (const raw of inputs) {
        const id = normalizeId(raw?.id ?? null);
        if (!id)
            continue;
        if (id === leavingUid)
            continue;
        if (byId.has(id)) {
            const existing = byId.get(id);
            existing.joinedAt = Math.min(existing.joinedAt, toTimestamp(raw?.joinedAt ?? null));
            existing.orderIndex = Math.min(existing.orderIndex, toOrderIndex(raw?.orderIndex ?? null));
            existing.lastSeenAt = Math.min(existing.lastSeenAt, toTimestamp(raw?.lastSeenAt ?? null));
            existing.isOnline = existing.isOnline || !!raw?.isOnline;
            if (!existing.name && raw?.name)
                existing.name = raw.name;
            continue;
        }
        const player = {
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
function normalizeId(value) {
    if (typeof value !== "string")
        return "";
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "";
}
function toTimestamp(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    return Number.MAX_SAFE_INTEGER;
}
function toOrderIndex(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    return Number.MAX_SAFE_INTEGER;
}
function selectHostCandidate(inputs, opts) {
    const leavingUid = normalizeId(opts?.leavingUid ?? null);
    const { players } = buildNormalizedPlayers(inputs, leavingUid);
    return players[0]?.id ?? null;
}
class HostManager {
    constructor(context) {
        this.roomId = context.roomId;
        this.currentHostId = normalizeId(context.currentHostId ?? null);
        this.leavingUid = normalizeId(context.leavingUid ?? null);
        const leavingUid = this.leavingUid;
        const { players, byId } = buildNormalizedPlayers(context.players, leavingUid);
        this.playersById = byId;
        this.orderedPlayers = players;
    }
    hasValidHost() {
        if (!this.currentHostId)
            return false;
        if (this.currentHostId === this.leavingUid)
            return false;
        return this.playersById.has(this.currentHostId);
    }
    resolvePrimaryCandidate() {
        if (this.orderedPlayers.length === 0)
            return null;
        return this.orderedPlayers[0] ?? null;
    }
    evaluateClaim(claimantId) {
        const claimant = normalizeId(claimantId ?? null);
        if (this.hasValidHost()) {
            return { action: "none", reason: "host-present", hostId: this.currentHostId };
        }
        const primary = this.resolvePrimaryCandidate();
        if (!primary) {
            return { action: "clear", reason: "no-players" };
        }
        const reason = claimant && claimant === primary.id ? "claim-success" : "auto-assign";
        return { action: "assign", reason, hostId: primary.id };
    }
    evaluateAfterLeave() {
        if (this.hasValidHost()) {
            return { action: "none", reason: "host-present", hostId: this.currentHostId };
        }
        const primary = this.resolvePrimaryCandidate();
        if (!primary) {
            return { action: "clear", reason: "no-players" };
        }
        return { action: "assign", reason: "host-left", hostId: primary.id };
    }
    getPlayerMeta(hostId) {
        const player = this.playersById.get(normalizeId(hostId));
        if (!player)
            return null;
        return { name: player.name };
    }
}
exports.HostManager = HostManager;
function buildHostPlayerInputsFromSnapshots(options) {
    const onlineSet = Array.isArray(options.onlineIds)
        ? new Set(options.onlineIds.map((id) => normalizeId(id)))
        : options.onlineIds instanceof Set
            ? new Set(Array.from(options.onlineIds).map((id) => normalizeId(id)))
            : new Set();
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
