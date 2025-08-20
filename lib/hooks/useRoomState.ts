"use client";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import { usePresence } from "@/lib/hooks/usePresence";
import { joinRoomFully } from "@/lib/services/roomService";
import { sanitizePlayer, sanitizeRoom } from "@/lib/state/sanitize";
import { ACTIVE_WINDOW_MS, isActive } from "@/lib/time";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
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

  // subscribe room and players
  useEffect(() => {
    if (!firebaseEnabled) return;
    const unsubRoom = onSnapshot(doc(db, "rooms", roomId), (snap) => {
      if (!snap.exists()) {
        setRoom(null);
        return;
      }
      setRoom({ id: snap.id, ...sanitizeRoom(snap.data()) });
    });
    const unsubPlayers = onSnapshot(
      query(collection(db, "rooms", roomId, "players"), orderBy("uid", "asc")),
      (snap) => {
        const list: (PlayerDoc & { id: string })[] = [];
        snap.forEach((d) => list.push(sanitizePlayer(d.id, d.data())));
        setPlayers(list);
        setLoading(false);
      }
    );
    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [roomId]);

  const isMember = useMemo(
    () => !!(uid && players.some((p) => p.id === uid)),
    [uid || "", players.map((p) => p.id).join(",")]
  );

  // presence attach + list
  const { onlineUids, detachNow } = usePresence(roomId, uid || null);

  // auto-join (always allow late join; numbers assigned according to phase)
  useEffect(() => {
    if (!firebaseEnabled) return;
    if (!uid || !room) return;
    if (leavingRef.current) return;
    // 待機中のみ自動参加を作成
    if (room.status === "waiting") {
      joinRoomFully({ roomId, uid, displayName: displayName }).catch(
        () => void 0
      );
    }
  }, [roomId, uid || "", room?.status]);

  const presenceOn = Array.isArray(onlineUids);
  const onlinePlayers = useMemo(() => {
    if (presenceOn) {
      const set = new Set(onlineUids);
      return players.filter((p) => set.has(p.id));
    }
    const now = Date.now();
    const base = players.filter((p) =>
      isActive((p as any)?.lastSeen, now, ACTIVE_WINDOW_MS)
    );
    // フォールバック時は自分自身を確実に含める（lastSeen更新前の瞬間的な欠落を補完）
    if (uid) {
      const me = players.find((p) => p.id === uid);
      if (me && !base.some((p) => p.id === uid)) base.push(me);
    }
    return base;
  }, [
    presenceOn,
    players,
    uid || "",
    Array.isArray(onlineUids) ? onlineUids.join(",") : "",
  ]);

  const isHost = useMemo(
    () => !!(room && uid && room.hostId === uid),
    [room?.hostId, uid || ""]
  );

  // exposure to caller
  const state: RoomState = {
    room,
    players,
    loading,
    onlineUids,
    onlinePlayers,
    isMember,
    isHost,
  };

  return { ...state, detachNow, leavingRef } as const;
}
