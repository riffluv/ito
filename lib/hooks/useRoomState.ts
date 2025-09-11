"use client";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import { useParticipants } from "@/lib/hooks/useParticipants";
import { joinRoomFully } from "@/lib/services/roomService";
import { sanitizeRoom } from "@/lib/state/sanitize";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
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

    const unsubRef = { current: null as null | (() => void) };
    const backoffUntilRef = { current: 0 };
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      try {
        unsubRef.current?.();
      } catch {}
      unsubRef.current = null;
    };

    const maybeStart = () => {
      if (unsubRef.current) return; // already subscribed
      const now = Date.now();
      if (now < backoffUntilRef.current) return; // still backing off
      unsubRef.current = onSnapshot(
        doc(db!, "rooms", roomId),
        (snap) => {
          if (!snap.exists()) {
            setRoom(null);
            return;
          }
          setRoom({ id: snap.id, ...sanitizeRoom(snap.data()) });
        },
        (err) => {
          if (isFirebaseQuotaExceeded(err)) {
            handleFirebaseQuotaError("ルーム購読");
            backoffUntilRef.current = Date.now() + 5 * 60 * 1000; // 5分バックオフ
            stop();
            if (backoffTimer) {
              try { clearTimeout(backoffTimer); } catch {}
              backoffTimer = null;
            }
            // 可視時にのみ自動再開を試みる
            const resume = () => {
              if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
              const remain = backoffUntilRef.current - Date.now();
              if (remain > 0) {
                backoffTimer = setTimeout(resume, Math.min(remain, 30_000));
              } else {
                maybeStart();
              }
            };
            resume();
          } else {
            // その他のエラー時は一旦nullに
            setRoom(null);
          }
        }
      );
    };

    // 初回: 可視状態のときのみ購読開始
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      maybeStart();
    }

    const onVis = () => {
      if (document.visibilityState === "visible") maybeStart();
      else stop();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
      if (backoffTimer) {
        try { clearTimeout(backoffTimer); } catch {}
      }
      stop();
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
  // さらに、displayName未設定時は入室を保留して名前入力ダイアログを促す
  useEffect(() => {
    if (!firebaseEnabled) return;
    if (!uid || !room) return;
    if (leavingRef.current) return;
    // displayName が空文字や未定義の場合はjoinを行わない（匿名作成を防止）
    if (!displayName || !String(displayName).trim()) return;
    if (room.status === "waiting") {
      joinRoomFully({ roomId, uid, displayName: displayName }).catch(
        () => void 0
      );
    }
  }, [roomId, uid || "", room?.status, displayName || ""]);

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
