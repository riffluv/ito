"use client";

import { showtime } from "@/lib/showtime";
import { publishShowtimeEvent, subscribeShowtimeEvents } from "@/lib/showtime/events";
import type {
  ShowtimeContext,
  ShowtimeEventType,
  ShowtimeIntentHandlers,
  ShowtimeIntentMetadata,
} from "@/lib/showtime/types";
import type { RoomDoc } from "@/lib/types";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { resolveRevealedMs } from "@/lib/hooks/showtimeFlow/helpers";
import { useCallback, useEffect, useMemo, useRef } from "react";

const ROUND_FLOW_METRIC_KEYS = [
  "startAt",
  "startSource",
  "roundPreparingAt",
  "roundPreparingDoneAt",
  "roundPreparingMs",
  "clueAt",
  "showtimeStartAt",
  "showtimeRevealAt",
  "revealAt",
  "finishedAt",
  "startToClueMs",
  "clueToShowtimeMs",
  "showtimeToRevealMs",
  "revealToFinishedMs",
  "startToFinishedMs",
] as const;
type RoundFlowTimestampKey =
  | "startAt"
  | "roundPreparingAt"
  | "roundPreparingDoneAt"
  | "clueAt"
  | "showtimeStartAt"
  | "showtimeRevealAt"
  | "revealAt"
  | "finishedAt";

type ShowtimeIntentState = {
  pending: boolean;
  intentId: string | null;
  markedAt: number | null;
  lastPublishedId: string | null;
  meta?: ShowtimeIntentMetadata | null;
};

type ShowtimePlaybackContext = Record<string, unknown> & {
  round?: number | null;
  status?: string | null;
  success?: boolean | null;
  revealedMs?: number | null;
};

type UseRoomShowtimeFlowParams = {
  roomId: string;
  room: RoomDoc;
};

export function useRoomShowtimeFlow(params: UseRoomShowtimeFlowParams) {
  const { roomId, room } = params;

  const showtimeProcessedRef = useRef<Set<string>>(new Set());
  const lastShowtimePlayRef = useRef<{ type: ShowtimeEventType; ts: number } | null>(null);
  const lastStartRequestIdRef = useRef<string | null>(null);
  const lastRevealTsRef = useRef<number | null>(null);
  const showtimeStartIntentRef = useRef<ShowtimeIntentState>({
    pending: false,
    intentId: null,
    markedAt: null,
    lastPublishedId: null,
    meta: null,
  });
  const showtimeRevealIntentRef = useRef<ShowtimeIntentState>({
    pending: false,
    intentId: null,
    markedAt: null,
    lastPublishedId: null,
    meta: null,
  });

  const getIntentRef = useCallback(
    (kind: "start" | "reveal") =>
      kind === "start" ? showtimeStartIntentRef : showtimeRevealIntentRef,
    []
  );

  const generateIntentId = useCallback(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      try {
        return crypto.randomUUID();
      } catch {
        /* ignore */
      }
    }
    return `intent-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);

  const markShowtimeIntent = useCallback(
    (kind: "start" | "reveal", meta?: ShowtimeIntentMetadata) => {
      const ref = getIntentRef(kind);
      const intentId = generateIntentId();
      ref.current = {
        pending: true,
        intentId,
        markedAt: Date.now(),
        lastPublishedId: ref.current.lastPublishedId ?? null,
        meta: meta ?? null,
      };
      traceAction("debug.showtime.intent", {
        roomId,
        action: "mark",
        kind,
        intentId,
        meta: meta ?? null,
      });
    },
    [generateIntentId, getIntentRef, roomId]
  );

  const clearShowtimeIntent = useCallback(
    (kind: "start" | "reveal") => {
      const ref = getIntentRef(kind);
      ref.current = {
        pending: false,
        intentId: null,
        markedAt: null,
        lastPublishedId: ref.current.lastPublishedId ?? null,
        meta: null,
      };
      traceAction("debug.showtime.intent", {
        roomId,
        action: "clear",
        kind,
      });
    },
    [getIntentRef, roomId]
  );

  const consumeShowtimeIntent = useCallback(
    (kind: "start" | "reveal"): ShowtimeIntentState | null => {
      const ref = getIntentRef(kind);
      if (!ref.current.pending || !ref.current.intentId) {
        return null;
      }
      const snapshot: ShowtimeIntentState = { ...ref.current };
      ref.current.pending = false;
      ref.current.lastPublishedId = snapshot.intentId;
      return snapshot;
    },
    [getIntentRef]
  );

  const showtimeIntentHandlers = useMemo<ShowtimeIntentHandlers>(
    () => ({
      markStartIntent: (meta) => markShowtimeIntent("start", meta),
      markRevealIntent: (meta) => markShowtimeIntent("reveal", meta),
      clearIntent: (kind) => clearShowtimeIntent(kind),
    }),
    [clearShowtimeIntent, markShowtimeIntent]
  );

  const roundFlowRef = useRef<{
    round: number | null;
    startAt: number | null;
    startSource: string | null;
    roundPreparingAt: number | null;
    roundPreparingDoneAt: number | null;
    clueAt: number | null;
    showtimeStartAt: number | null;
    showtimeRevealAt: number | null;
    revealAt: number | null;
    finishedAt: number | null;
  }>({
    round: null,
    startAt: null,
    startSource: null,
    roundPreparingAt: null,
    roundPreparingDoneAt: null,
    clueAt: null,
    showtimeStartAt: null,
    showtimeRevealAt: null,
    revealAt: null,
    finishedAt: null,
  });
  const recordRoundFlowMetric = useCallback(
    (key: string, value: number | string | null) => {
      setMetric("roundFlow", key, value);
    },
    []
  );
  const resetRoundFlowMetrics = useCallback(
    (nextRound: number | null) => {
      roundFlowRef.current = {
        round: nextRound,
        startAt: null,
        startSource: null,
        roundPreparingAt: null,
        roundPreparingDoneAt: null,
        clueAt: null,
        showtimeStartAt: null,
        showtimeRevealAt: null,
        revealAt: null,
        finishedAt: null,
      };
      recordRoundFlowMetric("round", nextRound);
      ROUND_FLOW_METRIC_KEYS.forEach((key) => recordRoundFlowMetric(key, null));
    },
    [recordRoundFlowMetric]
  );
  const getFlowNow = useCallback(() => {
    if (typeof performance === "undefined") return null;
    return performance.now();
  }, []);
  const ensureRoundFlowStart = useCallback(
    (source: string, at: number) => {
      const state = roundFlowRef.current;
      if (state.startAt !== null) return;
      state.startAt = at;
      state.startSource = source;
      recordRoundFlowMetric("startAt", Math.round(at));
      recordRoundFlowMetric("startSource", source);
    },
    [recordRoundFlowMetric]
  );
  const setFlowDuration = useCallback(
    (key: string, start: number | null, end: number | null) => {
      if (start === null || end === null) return;
      recordRoundFlowMetric(key, Math.max(0, Math.round(end - start)));
    },
    [recordRoundFlowMetric]
  );
  const markFlowTimestamp = useCallback(
    (key: RoundFlowTimestampKey, at: number) => {
      const state = roundFlowRef.current;
      if (state[key] !== null) return;
      state[key] = at;
      recordRoundFlowMetric(key, Math.round(at));
    },
    [recordRoundFlowMetric]
  );
  useEffect(() => {
    const nextRound = typeof room?.round === "number" ? room.round : null;
    if (roundFlowRef.current.round !== nextRound) {
      resetRoundFlowMetrics(nextRound);
    }
  }, [room?.round, resetRoundFlowMetrics]);

  const roundPreparing = room?.ui?.roundPreparing === true;
  const prevRoundPreparingRef = useRef<boolean | null>(null);
  useEffect(() => {
    const prev = prevRoundPreparingRef.current;
    prevRoundPreparingRef.current = roundPreparing;
    const now = getFlowNow();
    if (now === null) return;
    if (roundPreparing && !prev) {
      markFlowTimestamp("roundPreparingAt", now);
      ensureRoundFlowStart("roundPreparing", now);
      return;
    }
    if (!roundPreparing && prev) {
      markFlowTimestamp("roundPreparingDoneAt", now);
      setFlowDuration(
        "roundPreparingMs",
        roundFlowRef.current.roundPreparingAt,
        now
      );
    }
  }, [roundPreparing, ensureRoundFlowStart, getFlowNow, markFlowTimestamp, setFlowDuration]);

  const prevStatusForFlowRef = useRef<RoomDoc["status"] | null>(null);
  useEffect(() => {
    const status = room?.status ?? null;
    const prev = prevStatusForFlowRef.current;
    if (status === prev) return;
    prevStatusForFlowRef.current = status;
    const now = getFlowNow();
    if (now === null) return;
    if (status === "clue") {
      markFlowTimestamp("clueAt", now);
      ensureRoundFlowStart("clue", now);
      setFlowDuration("startToClueMs", roundFlowRef.current.startAt, now);
    }
    if (status === "reveal") {
      markFlowTimestamp("revealAt", now);
      if (roundFlowRef.current.showtimeRevealAt === null) {
        setFlowDuration(
          "showtimeToRevealMs",
          roundFlowRef.current.showtimeStartAt,
          now
        );
      }
    }
    if (status === "finished") {
      markFlowTimestamp("finishedAt", now);
      setFlowDuration(
        "revealToFinishedMs",
        roundFlowRef.current.revealAt ?? roundFlowRef.current.showtimeRevealAt,
        now
      );
      setFlowDuration("startToFinishedMs", roundFlowRef.current.startAt, now);
    }
  }, [room?.status, ensureRoundFlowStart, getFlowNow, markFlowTimestamp, setFlowDuration]);

  const recordShowtimePlayback = useCallback(
    (
      type: ShowtimeEventType,
      context: ShowtimePlaybackContext,
      meta: { origin: "intent" | "subscription" | "fallback"; intentId?: string | null; eventId?: string | null }
    ) => {
      const flowNow = getFlowNow();
      if (flowNow !== null) {
        if (type === "round:start") {
          markFlowTimestamp("showtimeStartAt", flowNow);
          ensureRoundFlowStart("showtime", flowNow);
          setFlowDuration("clueToShowtimeMs", roundFlowRef.current.clueAt, flowNow);
        } else if (type === "round:reveal") {
          markFlowTimestamp("showtimeRevealAt", flowNow);
          setFlowDuration(
            "showtimeToRevealMs",
            roundFlowRef.current.showtimeStartAt,
            flowNow
          );
        }
      }
      lastShowtimePlayRef.current = { type, ts: Date.now() };
      traceAction("debug.showtime.event.play", {
        roomId,
        type,
        origin: meta.origin,
        intentId: meta.intentId ?? null,
        eventId: meta.eventId ?? null,
        round: typeof context.round === "number" ? context.round : null,
        status: typeof context.status === "string" ? context.status : null,
        success:
          typeof context.success === "boolean"
            ? context.success
            : context.success ?? null,
      });
      void showtime.play(type, context);
    },
    [
      ensureRoundFlowStart,
      getFlowNow,
      markFlowTimestamp,
      roomId,
      setFlowDuration,
    ]
  );

  const publishIntentPlayback = useCallback(
    async (
      type: ShowtimeEventType,
      context: ShowtimePlaybackContext,
      intentSnapshot: ShowtimeIntentState
    ) => {
      const intentKey = intentSnapshot.intentId ? `intent:${intentSnapshot.intentId}` : null;
      if (intentKey) {
        showtimeProcessedRef.current.add(intentKey);
      }
      recordShowtimePlayback(type, context, {
        origin: "intent",
        intentId: intentSnapshot.intentId ?? null,
      });
      try {
        const eventId = await publishShowtimeEvent(roomId, {
          type,
          round: context.round ?? null,
          status: context.status ?? null,
          success: context.success ?? null,
          revealedMs: context.revealedMs ?? null,
          intentId: intentSnapshot.intentId ?? null,
          source: "intent",
        });
        if (eventId) {
          showtimeProcessedRef.current.add(eventId);
        }
      } catch (error) {
        traceError("debug.showtime.intent.publish", error, {
          roomId,
          type,
          intentId: intentSnapshot.intentId ?? null,
        });
      }
    },
    [recordShowtimePlayback, roomId]
  );

  useEffect(() => {
    if (!roomId) {
      return () => {};
    }
    showtimeProcessedRef.current.clear();
    lastShowtimePlayRef.current = null;
    lastStartRequestIdRef.current = null;
    const unsubscribe = subscribeShowtimeEvents(roomId, (event) => {
      const eventKey = event.intentId ? `intent:${event.intentId}` : event.id;
      if (eventKey && showtimeProcessedRef.current.has(eventKey)) {
        return;
      }
      if (eventKey) {
        showtimeProcessedRef.current.add(eventKey);
      }
      if (event.intentId) {
        if (showtimeStartIntentRef.current.lastPublishedId === event.intentId) {
          showtimeStartIntentRef.current.pending = false;
          showtimeStartIntentRef.current.intentId = null;
        }
        if (showtimeRevealIntentRef.current.lastPublishedId === event.intentId) {
          showtimeRevealIntentRef.current.pending = false;
          showtimeRevealIntentRef.current.intentId = null;
        }
      }
      if (event.type === "round:reveal" && typeof event.revealedMs === "number") {
        lastRevealTsRef.current = event.revealedMs;
      }
      let context: ShowtimeContext =
        event.type === "round:start"
          ? { round: event.round ?? null, status: event.status ?? null }
          : { success: event.success ?? null };
      const currentStatus = room?.status ?? null;
      // status をコンテキストに添える（シナリオ側の when 判定用）
      if (event.type === "round:reveal") {
        context = { ...context, status: currentStatus };
      }
      recordShowtimePlayback(event.type, context, {
        origin: "subscription",
        intentId: event.intentId ?? null,
        eventId: event.id,
      });
    });
    return () => {
      unsubscribe();
    };
  }, [recordShowtimePlayback, roomId, room?.status]);

  useEffect(() => {
    if (!room) {
      lastStartRequestIdRef.current = null;
      return;
    }
    if (!showtimeStartIntentRef.current.pending) {
      return;
    }
    if (room.status !== "clue") {
      return;
    }
    const startRequestId =
      typeof room.startRequestId === "string" && room.startRequestId.trim().length > 0
        ? room.startRequestId
        : null;
    if (!startRequestId) {
      return;
    }
    if (lastStartRequestIdRef.current === startRequestId) {
      return;
    }
    const intentSnapshot = consumeShowtimeIntent("start");
    if (!intentSnapshot) {
      return;
    }
    lastStartRequestIdRef.current = startRequestId;
    void publishIntentPlayback(
      "round:start",
      {
        round: typeof room.round === "number" && Number.isFinite(room.round) ? room.round : null,
        status: room.status ?? null,
      },
      intentSnapshot
    );
  }, [
    room,
    room?.status,
    room?.round,
    room?.startRequestId,
    consumeShowtimeIntent,
    publishIntentPlayback,
  ]);

  useEffect(() => {
    if (!room) {
      return;
    }
    if (!showtimeRevealIntentRef.current.pending) {
      return;
    }
    const status = room.status ?? null;
    const revealedMs = resolveRevealedMs(room.result?.revealedAt);
    const enteringReveal = status === "reveal";
    const finishingReveal =
      status === "finished" &&
      revealedMs !== null &&
      (lastRevealTsRef.current === null || revealedMs !== lastRevealTsRef.current);
    if (!enteringReveal && !finishingReveal) {
      return;
    }
    const intentSnapshot = consumeShowtimeIntent("reveal");
    if (!intentSnapshot) {
      return;
    }
    if (revealedMs !== null) {
      lastRevealTsRef.current = revealedMs;
    }
    void publishIntentPlayback(
      "round:reveal",
      {
        success: room.result?.success ?? null,
        revealedMs,
      },
      intentSnapshot
    );
  }, [
    room,
    room?.status,
    room?.result?.success,
    room?.result?.revealedAt,
    consumeShowtimeIntent,
    publishIntentPlayback,
  ]);

  return { showtimeIntentHandlers } as const;
}
