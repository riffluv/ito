import { RoomSummary } from './types';

export class InMemoryRoomStore {
  private byId = new Map<string, RoomSummary>();
  private lastTouch = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(opts?: { ttlMs?: number }) {
    this.ttlMs = opts?.ttlMs ?? 1000 * 60 * 60; // 60m default
  }

  create(room: RoomSummary) {
    this.byId.set(room.id, room);
    this.lastTouch.set(room.id, Date.now());
    return room;
  }

  update(id: string, patch: Partial<RoomSummary>) {
    const now = this.byId.get(id);
    if (!now) return null;
    const next = { ...now, ...patch } as RoomSummary;
    this.byId.set(id, next);
    this.lastTouch.set(id, Date.now());
    return next;
  }

  delete(id: string) {
    this.lastTouch.delete(id);
    return this.byId.delete(id);
  }

  get(id: string) {
    return this.byId.get(id) ?? null;
  }

  listPublic() {
    return [...this.byId.values()].filter(r => r.visibility === 'public');
  }

  prune(now = Date.now()) {
    const expired: string[] = [];
    for (const [id, ts] of this.lastTouch.entries()) {
      if (now - ts > this.ttlMs) expired.push(id);
    }
    expired.forEach(id => this.delete(id));
    return expired.length;
  }
}

