"use client";

import { resetPlayerState, setPlayerName } from "@/lib/firebase/players";
import { assignNumberIfNeeded, resetPlayerReadyOnRoundChange } from "@/lib/services/roomService";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { sanitizePlainText } from "@/lib/utils/sanitize";
import { useEffect, useMemo, useRef } from "react";

type RoomPlayer = PlayerDoc & { id: string };

type UseRoomPlayerHygieneParams = {
  roomId: string;
  room: RoomDoc;
  uid: string | null;
  me: RoomPlayer | null;
  players: RoomPlayer[];
  displayName: string | null | undefined;
};

export function useRoomPlayerHygiene(params: UseRoomPlayerHygieneParams) {
  const { roomId, room, uid, me, players, displayName } = params;

  const myPlayer = useMemo(() => {
    if (!uid) return null;
    return players.find((player) => player.id === uid) ?? null;
  }, [players, uid]);

  useEffect(() => {
    if (!uid || !me) return;
    if (room.status !== "clue") return;
    if (!room.deal || !room.deal.seed) return;
    if (!Array.isArray(room.deal.players) || !room.deal.players.includes(uid)) return;

    assignNumberIfNeeded(roomId, uid, room).catch(() => void 0);
  }, [
    room,
    room?.status,
    room?.deal?.seed,
    room?.deal?.players,
    uid,
    roomId,
    me,
  ]);

  const seenRoundRef = useRef<number>(0);
  useEffect(() => {
    if (!uid) return;
    const nextRound = room?.round || 0;
    if (nextRound === seenRoundRef.current) return;
    seenRoundRef.current = nextRound;
    // Avoid spurious calls/errors when the server has already reset "ready" (or when the user is not a member).
    if (myPlayer?.ready) {
      resetPlayerReadyOnRoundChange(roomId, uid, nextRound).catch(() => void 0);
    }
  }, [room?.round, uid, roomId, myPlayer?.ready]);

  const shouldResetPlayer = useMemo(() => {
    if (!myPlayer) return false;
    return (
      myPlayer.number !== null ||
      !!myPlayer.clue1 ||
      myPlayer.ready ||
      myPlayer.orderIndex !== 0
    );
  }, [myPlayer]);

  useEffect(() => {
    if (!uid || room?.status !== "waiting") return;
    if (!shouldResetPlayer) return;
    resetPlayerState(roomId, uid).catch(() => void 0);
  }, [room?.status, uid, roomId, shouldResetPlayer]);

  useEffect(() => {
    if (!uid) return;
    if (!myPlayer) return;
    if (typeof displayName !== "string") return;
    const trimmed = displayName.trim();
    if (!trimmed) return;
    const cleanName = sanitizePlainText(trimmed).slice(0, 24);
    if (!cleanName) return;
    const currentName = (myPlayer.name ?? "").trim();
    if (currentName === cleanName) return;
    setPlayerName(roomId, uid, cleanName).catch(() => void 0);
  }, [displayName, uid, roomId, myPlayer]);
}

