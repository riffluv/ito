"use client";

import { AppButton } from "@/components/ui/AppButton";
import { useRoomRequiredSwVersionHint } from "@/lib/hooks/useRoomRequiredSwVersionHint";
import { useRoomSafeUpdateAutomation } from "@/lib/hooks/useRoomSafeUpdateAutomation";
import { useRoomUpdateOverlays } from "@/lib/hooks/useRoomUpdateOverlays";
import { useServiceWorkerUpdate } from "@/lib/hooks/useServiceWorkerUpdate";

const SAFE_UPDATE_FORCE_APPLY_DELAY_MS = 2 * 60 * 1000;

type UseRoomLayoutUpdateUiParams = {
  safeUpdateFeatureEnabled: boolean;
  idleApplyMs: number;
  roomStatus: string | null;
  joinStatus: string;
  roomRequiredSwVersion: unknown;
};

export function useRoomLayoutUpdateUi(params: UseRoomLayoutUpdateUiParams) {
  const { safeUpdateFeatureEnabled, idleApplyMs, roomStatus, joinStatus, roomRequiredSwVersion } =
    params;

  const {
    isUpdateReady: spectatorUpdateReady,
    isApplying: spectatorUpdateApplying,
    hasError: spectatorUpdateFailed,
    phase: safeUpdatePhase,
    lastError: safeUpdateLastError,
    autoApplySuppressed: safeUpdateAutoApplySuppressed,
    autoApplyAt: safeUpdateAutoApplyAt,
    retryUpdate: retrySpectatorUpdate,
    applyUpdate: applySpectatorUpdate,
  } = useServiceWorkerUpdate();

  const requiredSwVersion = useRoomRequiredSwVersionHint(roomRequiredSwVersion);

  const versionMismatch = false;
  const { hasWaitingUpdate, safeUpdateActive, safeUpdateAutoApplyCountdown } =
    useRoomSafeUpdateAutomation({
      safeUpdateFeatureEnabled,
      idleApplyMs,
      forceApplyDelayMs: SAFE_UPDATE_FORCE_APPLY_DELAY_MS,
      roomStatus,
      versionMismatch,
      spectatorUpdateApplying,
      spectatorUpdateFailed,
      safeUpdateAutoApplyAt,
    });

  const shouldBlockUpdateOverlay = false;
  const { safeUpdateBannerNode, joinStatusBanner, versionMismatchOverlay } = useRoomUpdateOverlays({
    safeUpdateFeatureEnabled,
    hasWaitingUpdate,
    safeUpdateActive,
    spectatorUpdateApplying,
    spectatorUpdateFailed,
    shouldBlockUpdateOverlay,
    safeUpdatePhase,
    safeUpdateLastError,
    safeUpdateAutoApplySuppressed,
    safeUpdateAutoApplyCountdown,
    retrySpectatorUpdate,
    joinStatus,
    requiredSwVersion,
  });

  const spectatorUpdateButton = spectatorUpdateReady ? (
    <AppButton
      palette="brand"
      size="md"
      onClick={spectatorUpdateFailed ? retrySpectatorUpdate : applySpectatorUpdate}
      disabled={spectatorUpdateApplying}
    >
      {spectatorUpdateApplying
        ? "適用中..."
        : spectatorUpdateFailed
          ? "再試行"
          : "最新アップデートを適用"}
    </AppButton>
  ) : null;

  return { spectatorUpdateButton, safeUpdateBannerNode, joinStatusBanner, versionMismatchOverlay } as const;
}

