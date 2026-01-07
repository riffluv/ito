"use client";

import { notify } from "@/components/ui/notify";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RoomPlayer = PlayerDoc & { id: string };

type LedgerSnapshot = {
  players: RoomPlayer[];
  orderList: string[];
  topic: string | null;
  failed: boolean;
  roomId: string;
  myId: string;
  mvpVotes: Record<string, string> | null;
  stats: RoomDoc["stats"] | null;
};

type UseRoomLedgerStateParams = {
  roomId: string;
  room: RoomDoc;
  players: RoomPlayer[];
  myId: string;
};

export function useRoomLedgerState(params: UseRoomLedgerStateParams) {
  const { roomId, room, players, myId } = params;

  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [lastLedgerSnapshot, setLastLedgerSnapshot] = useState<LedgerSnapshot | null>(null);
  const previousRoomStatusRef = useRef<RoomDoc["status"] | null>(room.status ?? null);

  const ledgerOrderList = useMemo(() => {
    const orderList = room?.order?.list;
    if (!Array.isArray(orderList)) return [];
    return (orderList as (string | null | undefined)[])
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value): value is string => value.length > 0);
  }, [room?.order?.list]);

  const buildLedgerSnapshot = useCallback(
    (): LedgerSnapshot => ({
      players,
      orderList: ledgerOrderList,
      topic: room.topic ?? null,
      failed: !!room.order?.failed,
      roomId,
      myId,
      mvpVotes: room.mvpVotes ?? null,
      stats: room.stats ?? null,
    }),
    [
      ledgerOrderList,
      myId,
      players,
      room.mvpVotes,
      room.order?.failed,
      room.stats,
      room.topic,
      roomId,
    ]
  );

  useEffect(() => {
    if (room.status !== "finished") return;
    setLastLedgerSnapshot(buildLedgerSnapshot());
  }, [room.status, buildLedgerSnapshot]);

  useEffect(() => {
    setLastLedgerSnapshot(null);
    setIsLedgerOpen(false);
    previousRoomStatusRef.current = null;
  }, [roomId]);

  useEffect(() => {
    const previousStatus = previousRoomStatusRef.current;
    const currentStatus = room.status;
    if (previousStatus === "finished" && currentStatus !== "finished" && isLedgerOpen) {
      setIsLedgerOpen(false);
    }
    previousRoomStatusRef.current = currentStatus;
  }, [room.status, isLedgerOpen]);

  const usingLedgerSnapshot = room.status !== "finished" && !!lastLedgerSnapshot;
  const ledgerData = room.status === "finished" ? buildLedgerSnapshot() : lastLedgerSnapshot;
  const effectiveLedgerData = ledgerData ?? buildLedgerSnapshot();

  const canOpenLedger = room.status === "finished" || !!lastLedgerSnapshot;
  const ledgerButtonLabel = room.status === "finished" ? "戦績を見る" : "前の戦績を見る";
  const ledgerContextLabel = usingLedgerSnapshot ? "前ラウンドの戦績を表示中" : null;

  const handleOpenLedger = useCallback(() => {
    if (room.status === "finished" || lastLedgerSnapshot) {
      setIsLedgerOpen(true);
      return;
    }
    notify({
      id: "ledger-unavailable",
      type: "info",
      title: "まだ戦績がありません",
      description: "ラウンドを1回終えると戦績を見返せます。",
    });
  }, [room.status, lastLedgerSnapshot]);

  const handleCloseLedger = useCallback(() => setIsLedgerOpen(false), []);

  return {
    isLedgerOpen,
    usingLedgerSnapshot,
    effectiveLedgerData,
    canOpenLedger,
    ledgerButtonLabel,
    ledgerContextLabel,
    handleOpenLedger,
    handleCloseLedger,
  } as const;
}

