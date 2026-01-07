"use client";

import type { PlayerDoc } from "@/lib/types";
import { useEffect, type Dispatch, type SetStateAction } from "react";

type OptimisticPlayer = PlayerDoc & { id: string };

type UseRoomOptimisticSeatHoldParams = {
  uid: string | null;
  isSpectatorMode: boolean;
  meFromPlayers: OptimisticPlayer | undefined;
  me: OptimisticPlayer | null;
  joinEstablished: boolean;
  seatRequestPending: boolean;
  seatAcceptanceActive: boolean;
  seatRequestAccepted: boolean;
  displayName: string | null | undefined;
  optimisticMe: OptimisticPlayer | null;
  setOptimisticMe: Dispatch<SetStateAction<OptimisticPlayer | null>>;
};

const normalizeDisplayName = (displayName: string | null | undefined) => {
  if (typeof displayName === "string") {
    const trimmed = displayName.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return "匿名";
};

export function useRoomOptimisticSeatHold(params: UseRoomOptimisticSeatHoldParams) {
  const {
    uid,
    isSpectatorMode,
    meFromPlayers,
    me,
    joinEstablished,
    seatRequestPending,
    seatAcceptanceActive,
    seatRequestAccepted,
    displayName,
    optimisticMe,
    setOptimisticMe,
  } = params;

  useEffect(() => {
    if (!uid) {
      if (optimisticMe) {
        setOptimisticMe(null);
      }
      return;
    }
    if (isSpectatorMode) {
      if (optimisticMe) {
        setOptimisticMe(null);
      }
      return;
    }
    if (meFromPlayers) {
      if (optimisticMe) {
        setOptimisticMe(null);
      }
      return;
    }
    const shouldHoldOptimisticSeat = joinEstablished || seatRequestPending || seatAcceptanceActive;
    if (!shouldHoldOptimisticSeat) {
      if (optimisticMe) {
        setOptimisticMe(null);
      }
      return;
    }
    const baseName = normalizeDisplayName(displayName);
    setOptimisticMe((prev) => {
      if (prev && prev.id === uid && prev.name === baseName && prev.uid === uid) {
        return prev;
      }
      return {
        id: uid,
        name: baseName,
        avatar: prev?.avatar || "",
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0,
        uid,
      };
    });
  }, [
    uid,
    optimisticMe,
    isSpectatorMode,
    meFromPlayers,
    joinEstablished,
    seatRequestPending,
    seatAcceptanceActive,
    displayName,
    setOptimisticMe,
  ]);

  useEffect(() => {
    if (!seatRequestAccepted) return;
    if (!uid) return;
    if (me) return;
    const baseName = normalizeDisplayName(displayName);
    setOptimisticMe((prev) => {
      if (prev && prev.id === uid) {
        return prev;
      }
      return {
        id: uid,
        name: baseName,
        avatar: prev?.avatar || "",
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0,
        uid,
      } as OptimisticPlayer;
    });
  }, [seatRequestAccepted, uid, me, displayName, setOptimisticMe]);
}

