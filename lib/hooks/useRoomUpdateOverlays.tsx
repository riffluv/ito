"use client";

import { AppButton } from "@/components/ui/AppButton";
import { APP_VERSION } from "@/lib/constants/appVersion";
import {
  applyServiceWorkerUpdate,
  resyncWaitingServiceWorker,
  type SafeUpdatePhase,
} from "@/lib/serviceWorker/updateChannel";
import { logInfo } from "@/lib/utils/log";
import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { useCallback } from "react";

type UseRoomUpdateOverlaysParams = {
  safeUpdateFeatureEnabled: boolean;
  hasWaitingUpdate: boolean;
  safeUpdateActive: boolean;
  spectatorUpdateApplying: boolean;
  spectatorUpdateFailed: boolean;
  shouldBlockUpdateOverlay: boolean;
  safeUpdatePhase: SafeUpdatePhase;
  safeUpdateLastError: string | null;
  safeUpdateAutoApplySuppressed: boolean;
  safeUpdateAutoApplyCountdown: string | null;
  retrySpectatorUpdate: () => void;
  joinStatus: string;
  requiredSwVersion: string;
};

export function useRoomUpdateOverlays(params: UseRoomUpdateOverlaysParams) {
  const {
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
  } = params;

  const globalSafeUpdateActive =
    safeUpdateFeatureEnabled &&
    (hasWaitingUpdate || safeUpdateActive || spectatorUpdateApplying || spectatorUpdateFailed);

  const handleManualVersionUpdate = useCallback(() => {
    const applied = applyServiceWorkerUpdate({
      reason: "room:manual",
      safeMode: safeUpdateActive,
    });
    if (!applied) {
      void resyncWaitingServiceWorker("room:manual");
    }
  }, [safeUpdateActive]);

  const handleConfirmManualUpdate = useCallback(() => {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm("注意: 更新するとこの部屋に戻れない可能性があります。更新を適用しますか？");
    if (!confirmed) {
      return;
    }
    handleManualVersionUpdate();
  }, [handleManualVersionUpdate]);

  const handleResyncUpdate = useCallback(() => {
    void resyncWaitingServiceWorker("room:safe-banner");
  }, []);

  const safeUpdateBannerEnabled = globalSafeUpdateActive && !shouldBlockUpdateOverlay;
  const safeUpdateErrorLabel = spectatorUpdateFailed ? safeUpdateLastError ?? "unknown" : null;

  const safeUpdateStatusLabel = (() => {
    if (spectatorUpdateApplying || safeUpdatePhase === "applying") {
      return "更新を適用しています";
    }
    if (spectatorUpdateFailed || safeUpdatePhase === "failed") {
      return "更新に失敗しました";
    }
    if (safeUpdateAutoApplySuppressed || safeUpdatePhase === "suppressed") {
      return "プレイ進行中のため更新待機中";
    }
    if (
      hasWaitingUpdate ||
      safeUpdatePhase === "auto_pending" ||
      safeUpdatePhase === "waiting_user" ||
      safeUpdatePhase === "update_detected"
    ) {
      return "背景で更新を準備しています";
    }
    return "更新を確認しています";
  })();

  const safeUpdateDetailLabel = (() => {
    if (safeUpdateErrorLabel) {
      return `原因: ${safeUpdateErrorLabel}`;
    }
    if (safeUpdateAutoApplyCountdown) {
      return safeUpdateAutoApplyCountdown;
    }
    if (safeUpdateAutoApplySuppressed || safeUpdatePhase === "suppressed") {
      return "安全なタイミングで自動適用します";
    }
    if (spectatorUpdateApplying || safeUpdatePhase === "applying") {
      return "完了すると自動で再読み込みします";
    }
    if (hasWaitingUpdate) {
      return "注意: 更新するとこの部屋に戻れない可能性があります";
    }
    return null;
  })();

  const safeUpdatePrimaryLabel = spectatorUpdateApplying
    ? "適用中..."
    : spectatorUpdateFailed
      ? "再試行"
      : "更新 (注意)";

  const safeUpdatePrimaryAction = spectatorUpdateFailed
    ? retrySpectatorUpdate
    : handleConfirmManualUpdate;

  const safeUpdateBannerNode = safeUpdateBannerEnabled ? (
    <Box
      position="fixed"
      top="12px"
      right="16px"
      zIndex={1250}
      padding="12px 16px"
      background="rgba(8, 12, 20, 0.9)"
      border="1px solid rgba(255,255,255,0.18)"
      borderRadius="6px"
      boxShadow="0 8px 18px rgba(0,0,0,0.45)"
      minW="240px"
      maxW="320px"
    >
      <VStack align="stretch" gap={2}>
        <Text fontSize="sm" fontWeight={700} color="rgba(255,255,255,0.95)">
          {safeUpdateStatusLabel}
        </Text>
        {safeUpdateDetailLabel ? (
          <Text fontSize="xs" color="rgba(255,255,255,0.7)" lineHeight={1.5}>
            {safeUpdateDetailLabel}
          </Text>
        ) : null}
        <HStack gap={2} flexWrap="wrap">
          <AppButton
            palette="brand"
            size="sm"
            onClick={safeUpdatePrimaryAction}
            disabled={spectatorUpdateApplying}
          >
            {safeUpdatePrimaryLabel}
          </AppButton>
          <AppButton
            palette="gray"
            visual="outline"
            size="sm"
            onClick={handleResyncUpdate}
            disabled={spectatorUpdateApplying}
          >
            再チェック
          </AppButton>
        </HStack>
      </VStack>
    </Box>
  ) : null;

  const joinStatusMessage =
    joinStatus === "retrying"
      ? "再接続を試行しています..."
      : joinStatus === "joining"
        ? "ルームへ再参加中です..."
        : null;

  const joinStatusBanner = joinStatusMessage ? (
    <Box
      position="fixed"
      top={safeUpdateBannerEnabled ? "64px" : "12px"}
      right="16px"
      zIndex={1200}
      padding="10px 14px"
      background="rgba(8, 12, 20, 0.82)"
      border="1px solid rgba(255,255,255,0.18)"
      color="rgba(255,255,255,0.9)"
      fontFamily="'Courier New', monospace"
      fontSize="13px"
      borderRadius="4px"
      boxShadow="0 4px 12px rgba(0,0,0,0.35)"
    >
      {joinStatusMessage}
    </Box>
  ) : null;

  const handleHardReload = useCallback(() => {
    try {
      window.location.reload();
    } catch (error) {
      logInfo("room-page", "hard-reload-failed", error);
    }
  }, []);

  const versionMismatchOverlay = shouldBlockUpdateOverlay ? (
    <Box
      position="fixed"
      inset={0}
      zIndex={1400}
      bg="rgba(4, 6, 12, 0.88)"
      backdropFilter="blur(2px)"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Box
        maxW="520px"
        w="90%"
        bg="rgba(12,16,28,0.95)"
        border="3px solid rgba(255,255,255,0.85)"
        borderRadius={0}
        boxShadow="0 12px 32px rgba(0,0,0,0.65)"
        p={{ base: 5, md: 6 }}
      >
        <VStack align="stretch" gap={4}>
          <Text
            fontSize="lg"
            fontWeight={700}
            color="white"
            textAlign="center"
            textShadow="1px 1px 0 rgba(0,0,0,0.6)"
          >
            最新バージョンへの更新が必要です
          </Text>
          <Text color="rgba(255,255,255,0.9)" fontSize="sm" lineHeight={1.7}>
            サーバーはバージョン{" "}
            <strong>{requiredSwVersion || "unknown"}</strong> を要求しています。現在のクライアント
            ({APP_VERSION}) のままではゲームを続行できないため、更新を適用してから再開してください。
          </Text>
          <HStack gap={3} flexWrap="wrap" justify="center">
            <AppButton
              palette="brand"
              size="md"
              onClick={handleManualVersionUpdate}
              disabled={spectatorUpdateApplying}
            >
              {spectatorUpdateApplying ? "適用中..." : "今すぐ更新"}
            </AppButton>
            <AppButton palette="gray" size="md" visual="outline" onClick={handleHardReload}>
              ハードリロード
            </AppButton>
          </HStack>
          <Text color="rgba(255,255,255,0.7)" fontSize="xs" textAlign="center">
            更新が進まない場合はブラウザのキャッシュをクリアしてから再読み込みしてください。
          </Text>
        </VStack>
      </Box>
    </Box>
  ) : null;

  return { safeUpdateBannerNode, joinStatusBanner, versionMismatchOverlay } as const;
}

