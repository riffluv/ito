"use client";

import { notify } from "@/components/ui/notify";
import { requestSpectatorRecall } from "@/lib/firebase/rooms";
import type { RoomDoc } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useRoomHostActionsUi({
  roomId,
  room,
  isHost,
  spectatorHostPanelEnabled,
  canRecallSpectators,
  spectatorRecallEnabled,
}: {
  roomId: string;
  room: RoomDoc | null;
  isHost: boolean;
  spectatorHostPanelEnabled: boolean;
  canRecallSpectators: boolean;
  spectatorRecallEnabled: boolean;
}) {
  const [dealRecoveryDismissed, setDealRecoveryDismissed] = useState(false);
  const [dealRecoveryOpen, setDealRecoveryOpen] = useState(false);
  const dealRecoveryTimerRef = useRef<number | null>(null);

  const needsDealRecovery = useMemo(() => {
    if (!room || room.status !== "clue") return false;
    const deal = room.deal;
    if (!deal) return true;
    const dealPlayers = Array.isArray(deal.players)
      ? (deal.players as string[]).filter(
          (pid): pid is string => typeof pid === "string" && pid.length > 0
        )
      : [];
    return dealPlayers.length === 0;
  }, [room]);

  useEffect(() => {
    if (typeof window === "undefined") return () => {};

    if (!isHost || room?.status !== "clue") {
      if (dealRecoveryTimerRef.current !== null) {
        window.clearTimeout(dealRecoveryTimerRef.current);
        dealRecoveryTimerRef.current = null;
      }
      if (dealRecoveryOpen) {
        setDealRecoveryOpen(false);
      }
      if (dealRecoveryDismissed) {
        setDealRecoveryDismissed(false);
      }
      return () => {};
    }

    if (!needsDealRecovery) {
      if (dealRecoveryTimerRef.current !== null) {
        window.clearTimeout(dealRecoveryTimerRef.current);
        dealRecoveryTimerRef.current = null;
      }
      if (dealRecoveryOpen) {
        setDealRecoveryOpen(false);
      }
      if (dealRecoveryDismissed) {
        setDealRecoveryDismissed(false);
      }
      return () => {};
    }

    if (dealRecoveryDismissed) {
      if (dealRecoveryTimerRef.current !== null) {
        window.clearTimeout(dealRecoveryTimerRef.current);
        dealRecoveryTimerRef.current = null;
      }
      if (dealRecoveryOpen) {
        setDealRecoveryOpen(false);
      }
      return () => {};
    }

    if (dealRecoveryTimerRef.current !== null) {
      return () => {};
    }

    const timerId = window.setTimeout(() => {
      setDealRecoveryOpen(true);
      dealRecoveryTimerRef.current = null;
    }, 4500);

    dealRecoveryTimerRef.current = timerId;

    return () => {
      window.window.clearTimeout(timerId);
      if (dealRecoveryTimerRef.current === timerId) {
        dealRecoveryTimerRef.current = null;
      }
    };
  }, [
    isHost,
    room?.status,
    needsDealRecovery,
    dealRecoveryDismissed,
    dealRecoveryOpen,
  ]);

  const handleDealRecoveryDismiss = useCallback(() => {
    setDealRecoveryOpen(false);
    setDealRecoveryDismissed(true);
  }, []);

  const [recallPending, setRecallPending] = useState(false);

  const handleSpectatorRecall = useCallback(async () => {
    if (!spectatorHostPanelEnabled) {
      return;
    }
    if (recallPending) return;
    if (!canRecallSpectators) {
      notify({
        type: "info",
        title: "観戦者を呼び戻せません",
        description: "ホストのみ、かつ待機状態で操作できます。",
      });
      return;
    }
    if (spectatorRecallEnabled) {
      notify({
        type: "info",
        title: "観戦ウィンドウは開放済みです",
        description: "観戦者は「席にもどる」から復帰できます。",
      });
      return;
    }
    setRecallPending(true);
    try {
      await requestSpectatorRecall(roomId);
      notify({
        type: "success",
        title: "観戦者を呼び戻しました",
        description: "観戦者に再入室を案内してください。",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "観戦者の呼び戻しに失敗しました。";
      notify({
        type: "error",
        title: "観戦者を呼べませんでした",
        description: message,
      });
    } finally {
      setRecallPending(false);
    }
  }, [
    spectatorHostPanelEnabled,
    recallPending,
    canRecallSpectators,
    spectatorRecallEnabled,
    roomId,
  ]);

  return {
    dealRecoveryOpen,
    handleDealRecoveryDismiss,
    recallPending,
    handleSpectatorRecall,
  };
}
