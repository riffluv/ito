"use client";

import { useMemo } from "react";
import { Box, Text } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";
import { useServiceWorkerUpdate } from "@/lib/hooks/useServiceWorkerUpdate";

type SafeUpdateBannerProps = {
  offsetTop?: number;
};

export default function SafeUpdateBanner({ offsetTop = 12 }: SafeUpdateBannerProps) {
  const {
    phase,
    autoApplySuppressed,
    hasError,
    lastError,
    isApplying,
    isUpdateReady,
    applyUpdate,
    retryUpdate,
  } = useServiceWorkerUpdate();

  const shouldShow =
    isApplying ||
    phase === "applying" ||
    hasError ||
    phase === "failed" ||
    autoApplySuppressed ||
    phase === "suppressed" ||
    phase === "auto_pending" ||
    phase === "waiting_user" ||
    phase === "update_detected" ||
    isUpdateReady;

  const headline = useMemo(() => {
    if (isApplying || phase === "applying") {
      return "更新を適用中";
    }
    if (hasError || phase === "failed") {
      return "更新に失敗しました";
    }
    if (phase === "suppressed" || autoApplySuppressed) {
      return "自動更新を保留中";
    }
    if (phase === "auto_pending") {
      return "自動適用を準備中";
    }
    if (phase === "update_detected" || phase === "waiting_user") {
      return "新バージョン待機中";
    }
    return "新バージョン待機中";
  }, [autoApplySuppressed, hasError, isApplying, phase]);

  const actionType = useMemo(() => {
    if (isApplying || phase === "applying") {
      return null;
    }
    if (hasError || phase === "failed") {
      return "retry" as const;
    }
    if (phase === "suppressed" || autoApplySuppressed) {
      return "apply" as const;
    }
    if (
      phase === "auto_pending" ||
      phase === "waiting_user" ||
      phase === "update_detected" ||
      isUpdateReady
    ) {
      return "apply" as const;
    }
    return null;
  }, [autoApplySuppressed, hasError, isApplying, isUpdateReady, phase]);

  const description = useMemo(() => {
    if (isApplying || phase === "applying") {
      return "まもなくページが自動で再読み込みされます。";
    }
    if (hasError || phase === "failed") {
      switch (lastError) {
        case "timeout":
          return "タイムアウトしました。安全なタイミングで再試行します。";
        case "redundant":
          return "他の更新と衝突しました。少し待ってから再試行します。";
        case "no_waiting":
          return "更新対象が見つかりませんでした。ハードリロードを検討してください。";
        case "suppressed":
          return "ループガードが作動しました。手動更新で対応してください。";
        default:
          return "自動更新に失敗しました。手動更新を試してください。";
      }
    }
    if (phase === "suppressed" || autoApplySuppressed) {
      return "ループガードのため自動適用を停止しています。手動で適用できます。";
    }
    if (phase === "auto_pending") {
      return "進行中のゲームに影響がないタイミングで自動適用します。";
    }
    if (phase === "waiting_user" || phase === "update_detected") {
      return "更新を適用すると最新の修正が反映されます。";
    }
    return "進行中のゲームに影響がないタイミングで自動適用します。";
  }, [autoApplySuppressed, hasError, isApplying, lastError, phase]);

  if (!shouldShow) {
    return null;
  }

  return (
    <Box
      position="fixed"
      top={`${offsetTop}px`}
      right="16px"
      zIndex={1300}
      background="rgba(12, 16, 24, 0.88)"
      border="1px solid rgba(255, 255, 255, 0.25)"
      borderRadius="6px"
      padding="12px 16px"
      color="rgba(255,255,255,0.92)"
      fontFamily="'Courier New', monospace"
      pointerEvents={actionType ? "auto" : "none"}
      boxShadow="0 8px 18px rgba(0,0,0,0.35)"
      maxW="240px"
    >
      <Text fontSize="13px" letterSpacing="0.14em" textTransform="uppercase">
        {headline}
      </Text>
      <Text fontSize="12px" mt="6px" lineHeight="1.6">
        {description}
      </Text>
      {actionType ? (
        <AppButton
          mt="10px"
          size="sm"
          palette="brand"
          onClick={actionType === "retry" ? retryUpdate : applyUpdate}
          disabled={isApplying || phase === "applying"}
        >
          {actionType === "retry" ? "再試行する" : "今すぐ適用"}
        </AppButton>
      ) : null}
    </Box>
  );
}
