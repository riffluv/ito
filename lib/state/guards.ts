import type { RoomDoc } from "@/lib/types";

export type RoomStatus = RoomDoc["status"];
export type RoomEvent =
  | { type: "START_GAME" }
  | { type: "CONTINUE_AFTER_FAIL" }
  | { type: "FINISH" }
  | { type: "RESET" };

const transitions: Record<RoomStatus, RoomStatus[]> = {
  // Simplified: waiting -> clue -> finished (or back to waiting)
  waiting: ["clue"],
  clue: ["finished", "waiting"],
  // 'playing' removed; keep compatibility if old docs contain it by not listing forward transitions
  playing: [],
  finished: ["waiting", "clue"],
  reveal: ["finished"],
  // any legacy 'playing' status will be allowed to jump to finished via FINISH event fallback (handled below)
};

export function canTransition(from: RoomStatus, to: RoomStatus) {
  return transitions[from]?.includes(to) === true;
}

export function nextStatusForEvent(
  current: RoomStatus,
  ev: RoomEvent
): RoomStatus | null {
  switch (ev.type) {
    case "START_GAME":
      return canTransition(current, "clue") ? "clue" : null;
    case "CONTINUE_AFTER_FAIL":
      return canTransition(current, "clue") ? "clue" : null;
    case "FINISH":
      // allow finishing from clue or legacy playing/reveal
      if (canTransition(current, "finished")) return "finished";
      if (current === "playing") return "finished"; // legacy support
      return null;
    case "RESET":
      return canTransition(current, "waiting") ? "waiting" : null;
    default:
      return null;
  }
}
