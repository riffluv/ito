"use client";

import type { ReactNode } from "react";

import { useEffect, useMemo, useRef } from "react";

import { SpectatorNotice } from "@/components/ui/SpectatorNotice";
import { HandAreaSection } from "@/components/rooms/HandAreaSection";
import type { SpectatorHostRequest } from "@/lib/spectator/v2/useSpectatorHostQueue";
import type { SpectatorController } from "@/lib/spectator/v2/useSpectatorController";
import type { PlayerDoc } from "@/lib/types";

type HostPanelProps = {
  enabled: boolean;
  roomId: string;
  requests: SpectatorHostRequest[];
  loading: boolean;
  error: string | null;
  spectatorRecallEnabled: boolean;
  players: (PlayerDoc & { id: string })[];
  onApprove: (request: SpectatorHostRequest) => Promise<void>;
  onReject: (request: SpectatorHostRequest, reason: string | null) => Promise<void>;
  autoApprove?: boolean;
};

type SpectatorHUDProps = {
  controller: SpectatorController;
  seatRequestTimedOut: boolean;
  spectatorUpdateButton: ReactNode;
  onRetryJoin: () => void;
  onForceExit: () => void;
  isSpectatorMode: boolean;
  isMember: boolean;
  showHand: boolean;
  handNode?: ReactNode;
  host: HostPanelProps;
};

export function SpectatorHUD({
  controller,
  seatRequestTimedOut,
  spectatorUpdateButton,
  onRetryJoin,
  onForceExit,
  isSpectatorMode,
  isMember,
  showHand,
  handNode,
  host,
}: SpectatorHUDProps) {
  const autoApprovedRef = useRef<Set<string>>(new Set());

  const notice = useMemo(() => {
    if (!isSpectatorMode || isMember) {
      return null;
    }
    return (
      <SpectatorNotice
        reason={controller.state.reason}
        seatRequestState={controller.state.seatRequest}
        seatRequestPending={controller.state.seatRequestPending}
        seatRequestTimedOut={seatRequestTimedOut}
        seatRequestButtonDisabled={controller.state.seatRequestButtonDisabled}
        spectatorUpdateButton={spectatorUpdateButton}
        onRetryJoin={onRetryJoin}
        onForceExit={onForceExit}
      />
    );
  }, [
    controller.state.reason,
    controller.state.seatRequest,
    controller.state.seatRequestPending,
    controller.state.seatRequestButtonDisabled,
    seatRequestTimedOut,
    spectatorUpdateButton,
    onRetryJoin,
    onForceExit,
    isSpectatorMode,
    isMember,
  ]);

  useEffect(() => {
    if (!host.enabled || !host.autoApprove) return;
    if (host.error) return;
    if (host.loading) return;
    for (const request of host.requests) {
      if (autoApprovedRef.current.has(request.sessionId)) continue;
      autoApprovedRef.current.add(request.sessionId);
      host
        .onApprove(request)
        .catch(() => {
          autoApprovedRef.current.delete(request.sessionId);
        });
    }
  }, [host.enabled, host.autoApprove, host.error, host.loading, host.requests, host.onApprove]);

  useEffect(() => {
    if (!host.enabled || !host.autoApprove) {
      autoApprovedRef.current.clear();
    }
  }, [host.enabled, host.autoApprove]);

  const hostPanel = null;

  const renderedHand = showHand ? handNode : undefined;

  return (
    <HandAreaSection
      hostPanel={hostPanel}
      spectatorNotice={notice}
      handNode={renderedHand}
    />
  );
}
