"use client";

import { recordMetricDistribution } from "@/lib/perf/metricsClient";
import { reportOpsEvent } from "@/lib/telemetry/opsMonitoring";
import { useEffect, useRef, type MutableRefObject } from "react";
import type { RoomJoinStatus } from "@/lib/hooks/useRoomSnapshotAutoJoin";
import type { RoomAccessErrorDetail, RoomSyncHealth } from "@/lib/hooks/useRoomSnapshot";

export function useRoomSnapshotOpsReporting(params: {
  roomId: string;
  roomStatus: string | null;
  joinStatus: RoomJoinStatus;
  joinAttemptRef: MutableRefObject<number>;
  roomAccessError: string | null;
  roomAccessErrorDetail: RoomAccessErrorDetail | null;
  syncHealth: RoomSyncHealth;
  syncSnapshotAgeMs: number | null;
}) {
  const {
    roomId,
    roomStatus,
    joinStatus,
    joinAttemptRef,
    roomAccessError,
    roomAccessErrorDetail,
    syncHealth,
    syncSnapshotAgeMs,
  } = params;

  const lastJoinStatusRef = useRef(joinStatus);
  const lastRoomAccessErrorRef = useRef<string | null>(null);
  const lastSyncHealthRef = useRef<RoomSyncHealth>("initial");

  useEffect(() => {
    if (lastJoinStatusRef.current === joinStatus) return;
    reportOpsEvent({
      name: "room.join.status",
      metric: "ops.room.join.status",
      level: joinStatus === "retrying" ? "warning" : "info",
      tags: { status: joinStatus },
      extra: {
        roomId,
        phase: roomStatus ?? null,
        attempt: joinAttemptRef.current,
      },
    });
    if (joinStatus === "retrying") {
      reportOpsEvent({
        name: "room.join.retrying",
        metric: "ops.room.join.retrying",
        level: "warning",
        tags: { status: "retrying" },
        extra: {
          roomId,
          phase: roomStatus ?? null,
          attempt: joinAttemptRef.current,
        },
      });
    }
    lastJoinStatusRef.current = joinStatus;
  }, [joinStatus, joinAttemptRef, roomId, roomStatus]);

  useEffect(() => {
    if (lastRoomAccessErrorRef.current === roomAccessError) return;
    if (roomAccessError) {
      reportOpsEvent({
        name: "room.access.error",
        metric: "ops.room.access.error",
        level: "warning",
        tags: {
          code: roomAccessError,
          kind: roomAccessErrorDetail?.kind ?? "unknown",
        },
        extra: {
          roomId,
          phase: roomStatus ?? null,
          detail: roomAccessErrorDetail ?? null,
        },
      });
    } else if (lastRoomAccessErrorRef.current) {
      reportOpsEvent({
        name: "room.access.recovered",
        metric: "ops.room.access.recovered",
        level: "info",
        tags: {
          code: lastRoomAccessErrorRef.current,
        },
        extra: {
          roomId,
          phase: roomStatus ?? null,
        },
      });
    }
    lastRoomAccessErrorRef.current = roomAccessError;
  }, [roomAccessError, roomAccessErrorDetail, roomId, roomStatus]);

  useEffect(() => {
    if (lastSyncHealthRef.current === syncHealth) return;
    const degraded =
      syncHealth === "stale" || syncHealth === "recovering" || syncHealth === "blocked";
    reportOpsEvent({
      name: "room.sync.health",
      metric: "ops.room.sync.health",
      level: degraded ? "warning" : "info",
      tags: { health: syncHealth },
      extra: {
        roomId,
        phase: roomStatus ?? null,
      },
    });
    if (degraded && typeof syncSnapshotAgeMs === "number") {
      recordMetricDistribution("ops.room.sync.staleAgeMs", syncSnapshotAgeMs, {
        health: syncHealth,
      });
    }
    lastSyncHealthRef.current = syncHealth;
  }, [roomId, roomStatus, syncHealth, syncSnapshotAgeMs]);
}

