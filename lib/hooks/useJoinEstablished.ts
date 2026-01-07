"use client";

import { useEffect, useRef } from "react";

type UseJoinEstablishedParams = {
  isMember: boolean;
  joinStatus: string;
  roomStatus: string | null;
  graceMs?: number;
};

export function useJoinEstablished(params: UseJoinEstablishedParams) {
  const { isMember, joinStatus, roomStatus, graceMs = 15000 } = params;
  const lastSeenAsMemberRef = useRef<number | null>(null);

  useEffect(() => {
    if (isMember) {
      lastSeenAsMemberRef.current = Date.now();
    }
  }, [isMember]);

  const wasMemberRecently =
    lastSeenAsMemberRef.current !== null &&
    Date.now() - lastSeenAsMemberRef.current < graceMs;

  const joinEstablished =
    (joinStatus === "joined" && (isMember || roomStatus === "waiting")) ||
    wasMemberRecently;

  return { joinEstablished, wasMemberRecently } as const;
}

