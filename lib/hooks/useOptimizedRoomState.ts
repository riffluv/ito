"use client";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import { useParticipants } from "@/lib/hooks/useParticipants";
import { logError } from "@/lib/utils/log";
import { joinRoomFully } from "@/lib/services/roomService";
import { sanitizeRoom } from "@/lib/state/sanitize";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { doc, onSnapshot } from "firebase/firestore";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type OptimizedRoomState = {
  room: (RoomDoc & { id: string }) | null;
  players: (PlayerDoc & { id: string })[];
  loading: boolean;
  onlineUids?: string[];
  onlinePlayers: (PlayerDoc & { id: string })[];
  isMember: boolean;
  isHost: boolean;
};

// Selector types for fine-grained updates
type RoomSelector<T> = (state: OptimizedRoomState) => T;

interface UseOptimizedRoomStateOptions {
  // Optional selectors to only re-render when specific data changes
  roomSelector?: RoomSelector<any>;
  playersSelector?: RoomSelector<any>;
  statusSelector?: RoomSelector<any>;
  // Debounce updates (in ms) to prevent excessive re-renders
  debounceMs?: number;
}

export function useOptimizedRoomState(
  roomId: string,
  uid: string | null,
  displayName?: string | null,
  options: UseOptimizedRoomStateOptions = {}
) {
  const { debounceMs = 100 } = options;
  
  const [room, setRoom] = useState<(RoomDoc & { id: string }) | null>(null);
  const [players, setPlayers] = useState<(PlayerDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const leavingRef = useRef(false);
  
  // Debouncing mechanism
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<{
    room?: (RoomDoc & { id: string }) | null;
    players?: (PlayerDoc & { id: string })[];
    loading?: boolean;
  }>({});

  const applyPendingUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.room !== undefined) {
      setRoom(pendingUpdatesRef.current.room);
    }
    if (pendingUpdatesRef.current.players !== undefined) {
      setPlayers(pendingUpdatesRef.current.players);
    }
    if (pendingUpdatesRef.current.loading !== undefined) {
      setLoading(pendingUpdatesRef.current.loading);
    }
    pendingUpdatesRef.current = {};
  }, []);

  const scheduleDebouncedUpdate = useCallback((updates: typeof pendingUpdatesRef.current) => {
    // Merge updates
    Object.assign(pendingUpdatesRef.current, updates);
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      applyPendingUpdates();
      debounceTimeoutRef.current = null;
    }, debounceMs);
  }, [debounceMs, applyPendingUpdates]);

  // Cleanup debounce timeout
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        applyPendingUpdates();
      }
    };
  }, [applyPendingUpdates]);

  // Reset leaving flag when room/user changes
  useEffect(() => {
    leavingRef.current = false;
  }, [roomId, uid || ""]);

  // Subscribe to room with visibility gating and 429 backoff
  useEffect(() => {
    if (!firebaseEnabled) return;

    let lastRoomData: string | null = null;
    const unsubRef = { current: null as null | (() => void) };
    const backoffUntilRef = { current: 0 };
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      try { unsubRef.current?.(); } catch {}
      unsubRef.current = null;
    };

    const maybeStart = () => {
      if (unsubRef.current) return;
      const now = Date.now();
      if (now < backoffUntilRef.current) return;
      unsubRef.current = onSnapshot(
        doc(db!, "rooms", roomId),
        (snap) => {
          if (!snap.exists()) {
            if (lastRoomData !== null) {
              scheduleDebouncedUpdate({ room: null });
              lastRoomData = null;
            }
            return;
          }
          const newRoom = { id: snap.id, ...sanitizeRoom(snap.data()) };
          const newRoomData = JSON.stringify(newRoom);
          if (newRoomData !== lastRoomData) {
            scheduleDebouncedUpdate({ room: newRoom });
            lastRoomData = newRoomData;
          }
        },
        (error) => {
          if (isFirebaseQuotaExceeded(error)) {
            handleFirebaseQuotaError("ルーム購読(optimized)");
            backoffUntilRef.current = Date.now() + 5 * 60 * 1000;
            stop();
            if (backoffTimer) {
              try { clearTimeout(backoffTimer); } catch {}
              backoffTimer = null;
            }
            const resume = () => {
              if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
              const remain = backoffUntilRef.current - Date.now();
              if (remain > 0) backoffTimer = setTimeout(resume, Math.min(remain, 30_000));
              else maybeStart();
            };
            resume();
          } else {
            logError("useOptimizedRoomState", "subscription-error", error);
            scheduleDebouncedUpdate({ room: null });
          }
        }
      );
    };

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
      lastRoomData = null;
    };
  }, [roomId, scheduleDebouncedUpdate]);

  const isMember = useMemo(
    () => !!(uid && players.some((p) => p.id === uid)),
    [uid, players]
  );

  // Participants with optimized updates
  const {
    players: fetchedPlayers,
    onlineUids,
    participants,
    detach,
    loading: partLoading,
  } = useParticipants(roomId, uid || null);
  
  useEffect(() => {
    const playersChanged = JSON.stringify(fetchedPlayers) !== JSON.stringify(players);
    const loadingChanged = partLoading !== loading;
    
    if (playersChanged || loadingChanged) {
      const updates: typeof pendingUpdatesRef.current = {};
      
      if (playersChanged) {
        updates.players = fetchedPlayers;
      }
      if (loadingChanged) {
        updates.loading = partLoading === true;
      }
      
      scheduleDebouncedUpdate(updates);
    }
  }, [fetchedPlayers, partLoading, players, loading, scheduleDebouncedUpdate]);

  // Auto-join optimization - only when necessary
  const shouldAutoJoin = useMemo(() => {
    return (
      firebaseEnabled &&
      uid &&
      room &&
      !leavingRef.current &&
      room.status === "waiting" &&
      !isMember
    );
  }, [uid, room, isMember]);

  useEffect(() => {
    if (shouldAutoJoin) {
      joinRoomFully({ roomId, uid: uid!, displayName: displayName }).catch(
        () => void 0
      );
    }
  }, [shouldAutoJoin, roomId, uid, displayName]);

  const onlinePlayers = participants;

  const isHost = useMemo(
    () => !!(room && uid && room.hostId === uid),
    [room?.hostId, uid]
  );

  // Memoized state object to prevent unnecessary re-renders
  const state = useMemo((): OptimizedRoomState => ({
    room,
    players,
    loading,
    onlineUids,
    onlinePlayers,
    isMember,
    isHost,
  }), [room, players, loading, onlineUids, onlinePlayers, isMember, isHost]);

  // Apply selectors if provided
  const selectedState = useMemo(() => {
    if (options.roomSelector) {
      return options.roomSelector(state);
    }
    return state;
  }, [state, options.roomSelector]);

  const detachNow = detach;
  
  return { 
    ...selectedState, 
    detachNow, 
    leavingRef,
    // Debug info (development only)
    ...(process.env.NODE_ENV === 'development' && {
      _debug: {
        pendingUpdates: pendingUpdatesRef.current,
        hasDebounceActive: !!debounceTimeoutRef.current,
        lastUpdate: Date.now(),
      }
    })
  } as const;
}

// Specialized hooks for common use cases
export function useRoomStatus(roomId: string, uid: string | null) {
  return useOptimizedRoomState(roomId, uid, undefined, {
    roomSelector: (state) => ({
      status: state.room?.status,
      loading: state.loading,
      isHost: state.isHost,
    }),
    debounceMs: 50, // Faster updates for status changes
  });
}

export function usePlayersCount(roomId: string, uid: string | null) {
  return useOptimizedRoomState(roomId, uid, undefined, {
    playersSelector: (state) => ({
      playersCount: state.players.length,
      onlineCount: state.onlinePlayers.length,
      loading: state.loading,
    }),
    debounceMs: 200, // Slower updates for count changes
  });
}

export function useGameProgress(roomId: string, uid: string | null) {
  return useOptimizedRoomState(roomId, uid, undefined, {
    roomSelector: (state) => ({
      status: state.room?.status,
      order: state.room?.order,
      result: state.room?.result,
      resolveMode: state.room?.options?.resolveMode,
      playersCount: state.players.length,
      onlineCount: state.onlinePlayers.length,
      loading: state.loading,
    }),
    debounceMs: 75, // Balanced for game state changes
  });
}