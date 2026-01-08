"use client";

import { SpectatorHUD } from "@/components/rooms/SpectatorHUD";
import type { ComponentProps } from "react";

type SpectatorHudProps = ComponentProps<typeof SpectatorHUD>;

export type RoomHandAreaNodeProps = {
  controller: SpectatorHudProps["controller"];
  seatRequestTimedOut: SpectatorHudProps["seatRequestTimedOut"];
  spectatorUpdateButton: SpectatorHudProps["spectatorUpdateButton"];
  extraNotice: SpectatorHudProps["extraNotice"];
  onRetryJoin: SpectatorHudProps["onRetryJoin"];
  onForceExit: SpectatorHudProps["onForceExit"];
  isSpectatorMode: SpectatorHudProps["isSpectatorMode"];
  isMember: SpectatorHudProps["isMember"];
  showHand: SpectatorHudProps["showHand"];
  handNode: SpectatorHudProps["handNode"];
  hostPanelEnabled: SpectatorHudProps["hostPanelEnabled"];
  host: SpectatorHudProps["host"];
};

export function RoomHandAreaNode(props: RoomHandAreaNodeProps) {
  return <SpectatorHUD {...props} />;
}

