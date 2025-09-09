"use client";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import { useParticipants } from "@/lib/hooks/useParticipants";
import { joinRoomFully } from "@/lib/services/roomService";
import { sanitizeRoom } from "@/lib/state/sanitize";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";

export type RoomState = {
  room: (RoomDoc & { id: string }) | null;
  players: (PlayerDoc & { id: string })[];
  loading: boolean;
  onlineUids?: string[];
  onlinePlayers: (PlayerDoc & { id: string })[];
  isMember: boolean;
  isHost: boolean;
};

export function useRoomState(
  roomId: string,
  uid: string | null,
  displayName?: string | null
) {
  const [room, setRoom] = useState<(RoomDoc & { id: string }) | null>(null);
  const [players, setPlayers] = useState<(PlayerDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const leavingRef = useRef(false);

  // reset leaving flag when room/user changes
  useEffect(() => {
    leavingRef.current = false;
  }, [roomId, uid || ""]);

  // subscribe room
  useEffect(() => {
    if (!firebaseEnabled) return;
    const unsubRoom = onSnapshot(doc(db!, "rooms", roomId), (snap) => {
      if (!snap.exists()) {
        setRoom(null);
        return;
      }
      setRoom({ id: snap.id, ...sanitizeRoom(snap.data()) });
    });
    return () => {
      unsubRoom();
    };
  }, [roomId]);

  // メモ化の最適化: playersの変更を正確に検知
  const isMember = useMemo(
    () => !!(uid && players.some((p) => p.id === uid)),
    [uid, players]
  );

  // participants: Firestore players + RTDB presence
  const {
    players: fetchedPlayers,
    onlineUids,
    participants,
    detach,
    loading: partLoading,
  } = useParticipants(roomId, uid || null);
  useEffect(() => {
    setPlayers(fetchedPlayers);
    setLoading(partLoading === true);
  }, [fetchedPlayers, partLoading]);

  // auto-join (待機中のみ自動参加。ゲーム中の途中参加は禁止)
  useEffect(() => {
    if (!firebaseEnabled) return;
    if (!uid || !room) return;
    if (leavingRef.current) return;
    if (room.status === "waiting") {
      joinRoomFully({ roomId, uid, displayName: displayName }).catch(
        () => void 0
      );
    }
  }, [roomId, uid || "", room?.status]);

  const onlinePlayers = participants;

  const isHost = useMemo(
    () => !!(room && uid && room.hostId === uid),
    [room?.hostId, uid]
  );

  // メモ化されたstateオブジェクトで不必要な再レンダリングを防ぐ
  const state: RoomState = useMemo(
    () => ({
      room,
      players,
      loading,
      onlineUids,
      onlinePlayers,
      isMember,
      isHost,
    }),
    [room, players, loading, onlineUids, onlinePlayers, isMember, isHost]
  );

  const detachNow = detach;
  return { ...state, detachNow, leavingRef } as const;
}
