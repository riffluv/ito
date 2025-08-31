import type { RoomDoc } from "@/lib/types";

export type RoomStatus = RoomDoc["status"];
export type RoomEvent =
  | { type: "START_GAME" }
  | { type: "CONTINUE_AFTER_FAIL" }
  | { type: "FINISH" }
  | { type: "RESET" };

const transitions: Record<RoomStatus, RoomStatus[]> = {
  // waiting -> clue -> (reveal) -> finished
  waiting: ["clue"],
  clue: ["finished", "waiting", "reveal"],
  reveal: ["finished"],
  finished: ["waiting", "clue"],
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
      // allow finishing from clue or reveal
      return canTransition(current, "finished") ? "finished" : null;
    case "RESET":
      return canTransition(current, "waiting") ? "waiting" : null;
    default:
      return null;
  }
}
