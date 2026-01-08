"use client";

import { UI_TOKENS } from "@/theme/layout";
import {
  CARD_ANIMATION_OPTIONS,
  type AnimationModeOption,
  type CardAnimationOption,
} from "@/components/settings/settingsModalModel";
import { Box, HStack, Stack, Text, VStack } from "@chakra-ui/react";

export type SettingsModalGraphicsAnimationModeSectionProps = {
  gpuCapability?: "high" | "low";
  supports3D?: boolean;
  animationMode: AnimationModeOption;
  effectiveMode: CardAnimationOption;
  force3DTransforms: boolean;
  onForce3DTransformsChange: (next: boolean) => void;
  onAnimationModeChange: (next: AnimationModeOption) => void;
};

export function SettingsModalGraphicsAnimationModeSection(
  props: SettingsModalGraphicsAnimationModeSectionProps
) {
  const {
    gpuCapability,
    supports3D,
    animationMode,
    effectiveMode,
    force3DTransforms,
    onForce3DTransformsChange,
    onAnimationModeChange,
  } = props;

  return (
    <>
      <Text fontSize="sm" fontWeight="600" color="gray.300" mb={1}>
        アニメーション モード
      </Text>
      <Text fontSize="xs" color={UI_TOKENS.COLORS.textMuted} mb={1}>
        現在: {force3DTransforms ? "3D回転" : "シンプル"}（推定GPU:{" "}
        {gpuCapability === "high" ? "高" : "低"}）
      </Text>
      {effectiveMode === "simple" && animationMode !== "simple" && supports3D === false && (
        <Text fontSize="xs" color={UI_TOKENS.COLORS.whiteAlpha60} mb={3}>
          注: この端末では3Dが使えないため、シンプルで動作中
        </Text>
      )}
      <Stack gap={2}>
        {CARD_ANIMATION_OPTIONS.map((opt) => {
          const isAvailable = !(opt.value === "3d" && supports3D === false);
          const isSelected =
            opt.value === "3d" ? force3DTransforms : !force3DTransforms && animationMode === "simple";
          const handleClick = () => {
            onAnimationModeChange(opt.value);
            onForce3DTransformsChange(opt.value === "3d");
          };
          return (
            <Box
              key={opt.value}
              cursor={isAvailable ? "pointer" : "not-allowed"}
              onClick={isAvailable ? handleClick : undefined}
              opacity={isAvailable ? 1 : 0.5}
              p={4}
              borderRadius="0"
              border="2px solid"
              borderColor={
                isSelected ? UI_TOKENS.COLORS.whiteAlpha90 : UI_TOKENS.COLORS.whiteAlpha30
              }
              bg={isSelected ? UI_TOKENS.COLORS.whiteAlpha10 : UI_TOKENS.COLORS.panelBg}
              transition={`background-color 177ms cubic-bezier(.2,1,.3,1), border-color 177ms cubic-bezier(.2,1,.3,1), box-shadow 177ms cubic-bezier(.2,1,.3,1)`}
              boxShadow={
                isSelected ? UI_TOKENS.SHADOWS.panelDistinct : UI_TOKENS.SHADOWS.panelSubtle
              }
              _hover={
                isAvailable
                  ? {
                      borderColor: UI_TOKENS.COLORS.whiteAlpha80,
                      bg: isSelected
                        ? UI_TOKENS.COLORS.whiteAlpha15
                        : UI_TOKENS.COLORS.panelBg,
                    }
                  : {}
              }
            >
              <HStack justify="space-between" align="start">
                <VStack align="start" gap={1} flex="1">
                  <Text
                    fontSize="md"
                    fontWeight="bold"
                    color="white"
                    fontFamily="monospace"
                    textShadow="1px 1px 0px #000"
                  >
                    {opt.title}
                  </Text>
                  <Text
                    fontSize="sm"
                    color={UI_TOKENS.COLORS.textMuted}
                    lineHeight="short"
                    fontFamily="monospace"
                  >
                    {opt.description}
                  </Text>
                </VStack>
                <Box
                  w={5}
                  h={5}
                  borderRadius="0"
                  border="2px solid"
                  borderColor={isSelected ? "white" : UI_TOKENS.COLORS.whiteAlpha50}
                  bg={isSelected ? "white" : "transparent"}
                  mt={0.5}
                  position="relative"
                  transition="background-color 177ms cubic-bezier(.2,1,.3,1), border-color 177ms cubic-bezier(.2,1,.3,1)"
                >
                  {isSelected && (
                    <Box
                      position="absolute"
                      top="50%"
                      left="50%"
                      transform="translate(-50%, -50%)"
                      w="10px"
                      h="6px"
                      color="black"
                      fontWeight={880}
                      fontSize="12px"
                      fontFamily="monospace"
                      lineHeight={1}
                    >
                      ✓
                    </Box>
                  )}
                </Box>
              </HStack>
            </Box>
          );
        })}
      </Stack>
    </>
  );
}

