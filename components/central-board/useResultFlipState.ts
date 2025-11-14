"use client";

import { useCallback, useEffect, useState } from "react";

import type { RoomDoc } from "@/lib/types";

export function useResultFlipState(roomStatus: RoomDoc["status"], orderList: (string | null)[]) {
  const [resultFlipMap, setResultFlipMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (roomStatus !== "finished") {
      setResultFlipMap({});
      return;
    }

    setResultFlipMap((prev) => {
      const next: Record<string, boolean> = {};
      let changed = false;
      (orderList ?? []).forEach((cardId) => {
        if (!cardId) return;
        const existing = prev[cardId];
        if (existing === undefined) {
          changed = true;
        }
        next[cardId] = existing ?? true;
      });
      if (Object.keys(prev).length !== Object.keys(next).length) {
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [orderList, roomStatus]);

  const handleResultCardFlip = useCallback(
    (cardId: string) => {
      if (roomStatus !== "finished") return;
      setResultFlipMap((prev) => {
        const current = prev[cardId] ?? true;
        return { ...prev, [cardId]: !current };
      });
    },
    [roomStatus]
  );

  return { resultFlipMap, handleResultCardFlip };
}
