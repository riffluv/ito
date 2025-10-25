"use client";

import { useCallback, useMemo } from "react";
import { Box, HStack, Text } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";
import { useServiceWorkerUpdate } from "@/lib/hooks/useServiceWorkerUpdate";

type UpdateAvailableBadgeProps = {
  preview?: boolean;
};

const containerStyles = {
  background: "rgba(20, 24, 32, 0.9)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  boxShadow: "4px 4px 0 rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.08)",
  padding: "10px 14px",
  minWidth: "180px",
  maxWidth: "220px",
  color: "rgba(255,255,255,0.92)",
  fontFamily: "'Courier New', monospace",
};

export function UpdateAvailableBadge({ preview = false }: UpdateAvailableBadgeProps) {
  const {
    isUpdateReady,
    isApplying,
    hasError,
    phase,
    lastError,
    autoApplySuppressed,
    waitingSince,
    applyUpdate,
    retryUpdate,
  } = useServiceWorkerUpdate();

  const effectiveReady =
    preview || isUpdateReady || isApplying || hasError || autoApplySuppressed;
  const effectiveApplying = preview ? false : isApplying;

  const statusText = useMemo(() => {
    if (preview) {
      return "新しいバージョン";
    }
    if (effectiveApplying) {
      return "更新を適用中...";
    }
    if (phase === "failed") {
      return "更新に失敗しました";
    }
    if (autoApplySuppressed) {
      return "自動更新を保留中";
    }
    return "新しいバージョン";
  }, [autoApplySuppressed, effectiveApplying, phase, preview]);

  const helperText = useMemo(() => {
    if (preview) {
      return "プレビュー表示です";
    }
    if (effectiveApplying) {
      return "まもなくページが更新されます";
    }
    if (phase === "failed") {
      switch (lastError) {
        case "timeout":
          return "タイムアウトしました。再試行してください。";
        case "no_waiting":
          return "更新対象が見つかりませんでした。";
        case "redundant":
          return "他の更新と競合しました。";
        case "suppressed":
          return "自動適用は停止中です。";
        case "exception":
          return "更新中にエラーが発生しました。";
        default:
          return "更新に失敗しました。";
      }
    }
    if (autoApplySuppressed) {
      return "ループガードのため手動適用が必要です。";
    }
    if (waitingSince) {
      const elapsed = Date.now() - waitingSince;
      if (elapsed < 60_000) {
        return "アプデ来てるよ！更新してね。";
      }
      if (elapsed < 3_600_000) {
        const minutes = Math.round(elapsed / 60_000);
        return `約${minutes}分前に検知しました。`;
      }
      const hours = Math.round(elapsed / 3_600_000);
      return `約${hours}時間前に検知しました。`;
    }
    return "安全なタイミングで自動適用されます。";
  }, [autoApplySuppressed, effectiveApplying, lastError, phase, preview, waitingSince]);

  const handleClick = useCallback(() => {
    if (preview) return;
    if (phase === "failed") {
      retryUpdate();
      return;
    }
    applyUpdate();
  }, [applyUpdate, phase, preview, retryUpdate]);

  const buttonLabel = useMemo(() => {
    if (preview) {
      return "今すぐ更新";
    }
    if (phase === "failed") {
      return "再試行";
    }
    if (effectiveApplying) {
      return "適用中";
    }
    return "今すぐ更新";
  }, [effectiveApplying, phase, preview]);

  if (!effectiveReady) {
    return null;
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap="8px"
      mr={{ base: "10px", md: "14px" }}
      transformOrigin="left center"
      css={containerStyles}
    >
      <Text fontSize="13px" letterSpacing="0.08em" textTransform="uppercase">
        {statusText}
      </Text>
      {!preview && helperText ? (
        <Text fontSize="11px" color="rgba(255,255,255,0.7)" lineHeight="1.6">
          {helperText}
        </Text>
      ) : null}
      <HStack gap="8px" w="100%">
        <AppButton
          size="xs"
          palette="brand"
          visual="solid"
          onClick={preview ? undefined : handleClick}
          disabled={preview ? false : effectiveApplying}
          w="100%"
          fontSize="12px"
        >
          {buttonLabel}
        </AppButton>
      </HStack>
    </Box>
  );
}

export default UpdateAvailableBadge;
