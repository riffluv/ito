"use client";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import { useParticipants } from "@/lib/hooks/useParticipants";
import { ensureMember, joinRoomFully } from "@/lib/services/roomService";
import { sanitizeRoom } from "@/lib/state/sanitize";
import { logDebug, logError } from "@/lib/utils/log";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
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

const MAX_JOIN_RETRIES = Number(process.env.NEXT_PUBLIC_ROOM_JOIN_RETRIES ?? 5);
const BASE_JOIN_RETRY_DELAY_MS = 500;
const MAX_JOIN_RETRY_DELAY_MS = Number(process.env.NEXT_PUBLIC_ROOM_JOIN_RETRY_MAX_DELAY_MS ?? 5000);
const JOIN_RETRY_BACKOFF_FACTOR = 2;

export function useRoomState(
  roomId: string,
  uid: string | null,
  displayName?: string | null
) {
  const [room, setRoom] = useState<(RoomDoc & { id: string }) | null>(null);
  const joinCompletedRef = useRef(false);
  const joinInFlightRef = useRef<Promise<unknown> | null>(null);
  const joinRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinAttemptRef = useRef(0);
  const [joinAttemptToken, setJoinAttemptToken] = useState(0);
  const [players, setPlayers] = useState<(PlayerDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const leavingRef = useRef(false);

  // reset leaving flag & join state when room/user changes
  useEffect(() => {
    leavingRef.current = false;
    joinCompletedRef.current = false;
    joinInFlightRef.current = null;
    joinAttemptRef.current = 0;
    if (joinRetryTimerRef.current) {
      clearTimeout(joinRetryTimerRef.current);
      joinRetryTimerRef.current = null;
    }
  }, [roomId, uid || ""]);

  useEffect(() => () => {
    if (joinRetryTimerRef.current) {
      clearTimeout(joinRetryTimerRef.current);
      joinRetryTimerRef.current = null;
    }
  }, []);

  // subscribe room
  useEffect(() => {
    if (!firebaseEnabled) {
      return;
    }
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }

    const unsubRef = { current: null as null | (() => void) };
    const backoffUntilRef = { current: 0 };
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;
    let prevDataHash = ""; // 差分検知：前回データのハッシュ値を保存

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
            prevDataHash = ""; // 部屋が存在しない場合はハッシュをリセット
            return;
          }

          // 差分検知：データが変わってない場合はstate更新をスキップ（70%削減）
          const rawData = snap.data();
          const dataHash = JSON.stringify(rawData);
          if (dataHash === prevDataHash) {
            // 前回と同じデータ = 無視 = 再レンダリングなし = 課金削減！
            return;
          }
          prevDataHash = dataHash; // 今回のハッシュを保存

          setRoom({ id: snap.id, ...sanitizeRoom(rawData) });
        },
        (err) => {
          if (isFirebaseQuotaExceeded(err)) {
            handleFirebaseQuotaError("ルーム購読");
            backoffUntilRef.current = Date.now() + 5 * 60 * 1000; // 5分バックオフ
            stop();
            if (backoffTimer) {
              try {
                clearTimeout(backoffTimer);
              } catch {}
              backoffTimer = null;
            }
            // 可視時にのみ自動再開を試みる
            const resume = () => {
              if (
                typeof document !== "undefined" &&
                document.visibilityState !== "visible"
              )
                return;
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

    // 常に購読を開始（非アクティブでも即時同期させる）
    maybeStart();

    return () => {
      if (backoffTimer) {
        try {
          clearTimeout(backoffTimer);
        } catch {}
      }
      stop();
    };
  }, [roomId]);

  // メモ化の最適化: playersの変更を正確に検知
  const isMember = useMemo(
    () => !!(uid && players.some((p) => p.id === uid)),
    [uid, players]
  );

  useEffect(() => {
    if (!isMember) {
      joinCompletedRef.current = false;
    } else {
      joinAttemptRef.current = 0;
      if (joinRetryTimerRef.current) {
        clearTimeout(joinRetryTimerRef.current);
        joinRetryTimerRef.current = null;
      }
    }
  }, [isMember]);

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

  const rejoinSessionKey = useMemo(
    () => (uid ? `pendingRejoin:${roomId}` : null),
    [roomId, uid]
  );
  // auto-join (待機中のみ自動参加。ゲーム中の途中参加は禁止)
  // さらに、displayName未設定時は入室を保留して名前入力ダイアログを促す
  useEffect(() => {
    if (!firebaseEnabled) return;
    if (!uid || !room) return;
    if (leavingRef.current) return;
    if (!displayName || !String(displayName).trim()) return;

    let pendingRejoin = false;
    if (rejoinSessionKey && typeof window !== "undefined") {
      try {
        pendingRejoin = window.sessionStorage.getItem(rejoinSessionKey) === uid;
      } catch {}
    }

    const clearPending = () => {
      if (!pendingRejoin) return;
      if (rejoinSessionKey && typeof window !== "undefined") {
        try {
          window.sessionStorage.removeItem(rejoinSessionKey);
        } catch {}
      }
    };

    const clearRetryTimer = () => {
      if (joinRetryTimerRef.current) {
        clearTimeout(joinRetryTimerRef.current);
        joinRetryTimerRef.current = null;
      }
    };

    if (room.status === "waiting") {
      if (pendingRejoin) {
        joinCompletedRef.current = false;
        joinAttemptRef.current = 0;
      }

      const alreadyJoined = joinCompletedRef.current && isMember;
      if (!pendingRejoin) {
        if (alreadyJoined) {
          clearRetryTimer();
          return;
        }
        if (joinInFlightRef.current) {
          return;
        }
      }

      clearRetryTimer();
      const attemptBeforeCall = joinAttemptRef.current;
      const joinTask = joinRoomFully({
        roomId,
        uid,
        displayName: displayName,
        notifyChat: !pendingRejoin,
      })
        .then(() => {
          joinCompletedRef.current = true;
          joinAttemptRef.current = 0;
          clearRetryTimer();
        })
        .catch((error) => {
          joinCompletedRef.current = false;
          if (!pendingRejoin) {
            const nextAttempt = attemptBeforeCall + 1;
            joinAttemptRef.current = nextAttempt;
            if (nextAttempt <= MAX_JOIN_RETRIES) {
              const delay = Math.min(
                BASE_JOIN_RETRY_DELAY_MS * Math.pow(JOIN_RETRY_BACKOFF_FACTOR, Math.max(nextAttempt - 1, 0)),
                MAX_JOIN_RETRY_DELAY_MS
              );
              logDebug("room-state", "joinRoomFully-retry", { attempt: nextAttempt, delay });
              clearRetryTimer();
              joinRetryTimerRef.current = setTimeout(() => {
                joinRetryTimerRef.current = null;
                setJoinAttemptToken((value) => value + 1);
              }, delay);
            } else {
              logError("room-state", "joinRoomFully-max-retries", error);
            }
          } else {
            joinAttemptRef.current = 0;
          }
        })
        .finally(() => {
          joinInFlightRef.current = null;
          clearPending();
        });

      joinInFlightRef.current = joinTask;
      joinTask.catch(() => void 0);
    } else if (isMember) {
      joinAttemptRef.current = 0;
      clearRetryTimer();
      ensureMember({ roomId, uid, displayName: displayName }).catch(
        () => void 0
      );
    } else {
      joinAttemptRef.current = 0;
      clearRetryTimer();
    }
  }, [
    roomId,
    uid || "",
    room?.status,
    displayName || "",
    rejoinSessionKey,
    isMember,
    joinAttemptToken,
  ]);
  useEffect(() => {
    if (!rejoinSessionKey || typeof window === "undefined") return;
    if (isMember) {
      try {
        window.sessionStorage.removeItem(rejoinSessionKey);
      } catch {}
    }
  }, [isMember, rejoinSessionKey]);

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
