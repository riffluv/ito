"use client";

import { useEffect, useState } from "react";

import { isRevealing as selectIsRevealing } from "@/lib/game/selectors";
import type { RoomDoc } from "@/lib/types";

export function useRevealStatus(
  roomId: string,
  roomStatus: RoomDoc["status"],
  uiRevealPending: boolean
) {
  const [localRevealPending, setLocalRevealPending] = useState(false);

  useEffect(() => {
    const onLocalBegin = (event: Event) => {
      const detailRoom = (event as CustomEvent<{ roomId?: string }>).detail?.roomId;
      if (detailRoom && detailRoom !== roomId) return;
      setLocalRevealPending(true);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("ito:local-reveal-begin", onLocalBegin as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("ito:local-reveal-begin", onLocalBegin as EventListener);
      }
    };
  }, [roomId]);

  useEffect(() => {
    if ((roomStatus === "reveal" || roomStatus === "finished") && localRevealPending) {
      setLocalRevealPending(false);
    }
  }, [roomStatus, localRevealPending]);

  const isRevealing = selectIsRevealing({
    status: roomStatus,
    localHide: localRevealPending,
    uiRevealPending,
  });

  return { isRevealing, localRevealPending };
}
