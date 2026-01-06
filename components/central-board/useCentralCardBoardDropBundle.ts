"use client";

import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";

import { useBoardDropState } from "./useBoardDropState";

export function useCentralCardBoardDropBundle(params: {
  roomId: string;
  meId: string;
  me: (PlayerDoc & { id: string }) | undefined;
  roomStatus: RoomDoc["status"];
  orderList: string[];
  proposal: (string | null)[] | undefined;
  hasNumber: boolean;
  mePlaced: boolean;
  dealReady: boolean;
  dealGuardActive: boolean;
  interactionEnabled: boolean;
}): ReturnType<typeof useBoardDropState> & {
  playDropInvalid: ReturnType<typeof useSoundEffect>;
  playCardPlace: ReturnType<typeof useSoundEffect>;
  playDragPickup: ReturnType<typeof useSoundEffect>;
} {
  const {
    roomId,
    meId,
    me,
    roomStatus,
    orderList,
    proposal,
    hasNumber,
    mePlaced,
    dealReady,
    dealGuardActive,
    interactionEnabled,
  } = params;

  const dropState = useBoardDropState({
    roomId,
    meId,
    me,
    roomStatus,
    orderList,
    proposal,
    hasNumber,
    mePlaced,
    dealReady,
    dealGuardActive,
    interactionEnabled,
  });

  const playDropInvalid = useSoundEffect(undefined);
  const playCardPlace = useSoundEffect("card_place");
  const playDragPickup = useSoundEffect(undefined);

  return {
    ...dropState,
    playDropInvalid,
    playCardPlace,
    playDragPickup,
  };
}

