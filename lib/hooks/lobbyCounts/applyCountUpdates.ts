import type { Dispatch, SetStateAction } from "react";

export function applyCountUpdates(
  setCounts: Dispatch<SetStateAction<Record<string, number>>>,
  updates: Record<string, number>
): void {
  const entries = Object.entries(updates);
  if (entries.length === 0) return;
  setCounts((prev) => {
    let changed = false;
    const next: Record<string, number> = { ...prev };
    for (const [id, value] of entries) {
      if (next[id] !== value) {
        next[id] = value;
        changed = true;
      }
    }
    return changed ? next : prev;
  });
}
