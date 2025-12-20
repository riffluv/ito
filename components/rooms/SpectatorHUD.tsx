"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { VStack } from "@chakra-ui/react";

import { SpectatorNotice } from "@/components/ui/SpectatorNotice";
import { SpectatorRejoinManager } from "@/components/ui/SpectatorRejoinManager";
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
  canRecallSpectators: boolean;
  recallPending: boolean;
  onRecallSpectators: () => Promise<void>;
  players: (PlayerDoc & { id: string })[];
  onApprove: (request: SpectatorHostRequest) => Promise<void>;
  onReject: (request: SpectatorHostRequest, reason: string | null) => Promise<void>;
  autoApprove?: boolean;
};

type SpectatorHUDProps = {
  controller: SpectatorController;
  seatRequestTimedOut: boolean;
  spectatorUpdateButton: ReactNode;
  extraNotice?: ReactNode;
  onRetryJoin: () => void;
  onForceExit: () => void;
  isSpectatorMode: boolean;
  isMember: boolean;
  showHand: boolean;
  handNode?: ReactNode;
  host: HostPanelProps;
  hostPanelEnabled?: boolean;
};

export function SpectatorHUD({
  controller,
  seatRequestTimedOut,
  spectatorUpdateButton,
  extraNotice,
  onRetryJoin,
  onForceExit,
  isSpectatorMode,
  isMember,
  showHand,
  handNode,
  host,
  hostPanelEnabled = true,
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

  const mergedNotice = useMemo(() => {
    if (!extraNotice && !notice) return null;
    return (
      <VStack gap={3} align="stretch">
        {extraNotice}
        {notice}
      </VStack>
    );
  }, [extraNotice, notice]);

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
  }, [host]);

  useEffect(() => {
    if (!host.enabled || !host.autoApprove) {
      autoApprovedRef.current.clear();
    }
  }, [host.enabled, host.autoApprove]);

  const hostPanel = hostPanelEnabled && host.enabled ? (
    <SpectatorRejoinManager
      roomId={host.roomId}
      requests={host.requests}
      loading={host.loading}
      error={host.error}
      spectatorRecallEnabled={host.spectatorRecallEnabled}
      canRecallSpectators={host.canRecallSpectators}
      recallPending={host.recallPending}
      onRecallSpectators={host.onRecallSpectators}
      players={host.players}
      onApprove={host.onApprove}
      onReject={host.onReject}
    />
  ) : null;

  const renderedHand = showHand ? handNode : undefined;

  return (
    <HandAreaSection
      hostPanel={hostPanel}
      spectatorNotice={mergedNotice}
      handNode={renderedHand}
    />
  );
}
