"use client";

import { UI_TOKENS } from "@/theme/layout";
import { Box, HStack, Stack, Text, VStack } from "@chakra-ui/react";

export type SettingsModalGraphicsAnimationPreferenceSectionProps = {
  forceAnimations: boolean;
  osReduced: boolean;
  onForceAnimationsChange: (next: boolean) => void;
};

export function SettingsModalGraphicsAnimationPreferenceSection(
  props: SettingsModalGraphicsAnimationPreferenceSectionProps
) {
  const { forceAnimations, osReduced, onForceAnimationsChange } = props;

  return (
    <>
      <Text fontSize="sm" fontWeight="600" color="gray.300" mb={1}>
        アニメの基準（どちらを優先するか）
      </Text>
      <Text fontSize="xs" color={UI_TOKENS.COLORS.textMuted} mb={2}>
        端末の設定: 動きを減らす = {osReduced ? "ON" : "OFF"}
      </Text>
      <Stack gap={2}>
        <Box
          cursor="pointer"
          onClick={() => onForceAnimationsChange(false)}
          p={4}
          borderRadius="0"
          border="2px solid"
          borderColor={
            !forceAnimations ? UI_TOKENS.COLORS.whiteAlpha90 : UI_TOKENS.COLORS.whiteAlpha30
          }
          bg={!forceAnimations ? UI_TOKENS.COLORS.whiteAlpha10 : UI_TOKENS.COLORS.panelBg}
        >
          <HStack justify="space-between" align="center">
            <VStack align="start" gap={1} flex="1">
              <Text
                fontSize="md"
                fontWeight="bold"
                color="white"
                fontFamily="monospace"
                textShadow="1px 1px 0px #000"
              >
                自動（端末に合わせる・おすすめ）
              </Text>
              <Text
                fontSize="sm"
                color={UI_TOKENS.COLORS.textMuted}
                lineHeight="short"
                fontFamily="monospace"
              >
                端末が「動きを減らす=ON」なら控えめ、「OFF」なら通常のアニメになります
              </Text>
            </VStack>
            <Box
              w={5}
              h={5}
              borderRadius="0"
              border="2px solid"
              borderColor={!forceAnimations ? "white" : UI_TOKENS.COLORS.whiteAlpha50}
              bg={!forceAnimations ? "white" : "transparent"}
            />
          </HStack>
        </Box>
        <Box
          cursor="pointer"
          onClick={() => onForceAnimationsChange(true)}
          p={4}
          borderRadius="0"
          border="2px solid"
          borderColor={
            forceAnimations ? UI_TOKENS.COLORS.whiteAlpha90 : UI_TOKENS.COLORS.whiteAlpha30
          }
          bg={forceAnimations ? UI_TOKENS.COLORS.whiteAlpha10 : UI_TOKENS.COLORS.panelBg}
        >
          <HStack justify="space-between" align="center">
            <VStack align="start" gap={1} flex="1">
              <Text
                fontSize="md"
                fontWeight="bold"
                color="white"
                fontFamily="monospace"
                textShadow="1px 1px 0px #000"
              >
                常に動かす（reduce-motionを無視）
              </Text>
              <Text
                fontSize="sm"
                color={UI_TOKENS.COLORS.textMuted}
                lineHeight="short"
                fontFamily="monospace"
              >
                アクセシビリティ設定に関わらず、軽量アニメを有効にします
              </Text>
            </VStack>
            <Box
              w={5}
              h={5}
              borderRadius="0"
              border="2px solid"
              borderColor={forceAnimations ? "white" : UI_TOKENS.COLORS.whiteAlpha50}
              bg={forceAnimations ? "white" : "transparent"}
            />
          </HStack>
        </Box>
      </Stack>
      <Text fontSize="xs" color={UI_TOKENS.COLORS.textMuted} mt={2}>
        いま適用:{" "}
        {forceAnimations
          ? "常に動かす（軽量アニメON）"
          : osReduced
            ? "自動（控えめアニメ）"
            : "自動（通常アニメ）"}
      </Text>
      <Text fontSize="xs" color={UI_TOKENS.COLORS.whiteAlpha60} mt={1}>
        これは? →
        「動きを減らす」は端末のアクセシビリティ設定です。目の疲れや酔いが出やすい方向けに、動きを少なくする指示をアプリに伝えます。
      </Text>
    </>
  );
}

