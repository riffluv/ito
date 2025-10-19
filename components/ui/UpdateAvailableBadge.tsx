"use client";

import { useMemo } from "react";
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
  const { isUpdateReady, isApplying, applyUpdate } = useServiceWorkerUpdate();

  const effectiveReady = preview || isUpdateReady || isApplying;
  const effectiveApplying = preview ? false : isApplying;

  const statusText = useMemo(() => {
    if (effectiveApplying) {
      return "更新を適用中...";
    }
    return "新しいバージョン";
  }, [effectiveApplying]);

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
      <HStack gap="8px" w="100%">
        <AppButton
          size="xs"
          palette="brand"
          visual="solid"
          onClick={preview ? undefined : applyUpdate}
          disabled={preview ? false : effectiveApplying}
          w="100%"
          fontSize="12px"
        >
          今すぐ更新
        </AppButton>
      </HStack>
    </Box>
  );
}

export default UpdateAvailableBadge;
