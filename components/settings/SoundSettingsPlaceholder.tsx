"use client";
import { Box, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import Tooltip from "@/components/ui/Tooltip";
import { UI_TOKENS } from "@/theme/layout";

const SOUND_SLOTS = [
  "ui_click",
  "card_flip",
  "drag_pickup",
  "drop_success",
  "drop_invalid",
  "notify_success",
  "notify_error",
  "result_victory",
  "result_failure",
];

export type SoundSettingsPlaceholderProps = {
  locked: boolean;
  message: string;
  masterVolume: number;
  muted: boolean;
  soundManagerReady: boolean;
};

export function SoundSettingsPlaceholder({
  locked,
  message,
  masterVolume,
  muted,
  soundManagerReady,
}: SoundSettingsPlaceholderProps) {
  const displayVolume = Math.round(masterVolume * 100);
  const managerStatus = soundManagerReady ? "待機中" : "初期化待ち";

  return (
    <Stack gap={6}>
      <Tooltip content={message} showArrow openDelay={200} disabled={!locked}>
        <Box
          border="2px solid"
          borderColor={UI_TOKENS.COLORS.whiteAlpha30}
          bg={UI_TOKENS.COLORS.panelBg}
          p={4}
          borderRadius={0}
          position="relative"
          textAlign="center"
          boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
          transition={`background-color 0.15s ${UI_TOKENS.EASING.standard}, border-color 0.15s ${UI_TOKENS.EASING.standard}, box-shadow 0.15s ${UI_TOKENS.EASING.standard}`}
          _hover={{
            borderColor: UI_TOKENS.COLORS.whiteAlpha80,
            bg: UI_TOKENS.COLORS.whiteAlpha10,
          }}
        >
          <Text
            fontSize="md"
            fontWeight="bold"
            color="white"
            fontFamily="monospace"
            textShadow="1px 1px 0px #000"
            mb={2}
          >
            サウンド設定
          </Text>
          <Text
            fontSize="sm"
            color={UI_TOKENS.COLORS.textMuted}
            fontFamily="monospace"
            lineHeight="short"
          >
            音作ってるから待ってて！
          </Text>
          {locked && (
            <Box
              mt={3}
              display="inline-block"
              px={3}
              py={1}
              border="2px solid"
              borderColor={UI_TOKENS.COLORS.whiteAlpha60}
              bg={UI_TOKENS.COLORS.whiteAlpha10}
              color="white"
              fontFamily="monospace"
              fontSize="sm"
              fontWeight="bold"
            >
              準備中
            </Box>
          )}
        </Box>
      </Tooltip>

      <Stack
        gap={4}
        opacity={locked ? 0.55 : 1}
        pointerEvents={locked ? "none" : "auto"}
        filter={locked ? "grayscale(0.25)" : "none"}
      >
        <Box
          p={4}
          borderRadius={0}
          border="2px solid"
          borderColor={UI_TOKENS.COLORS.whiteAlpha30}
          bg={UI_TOKENS.COLORS.panelBg}
          boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
        >
          <HStack justify="space-between" align="center">
            <Text
              fontSize="md"
              fontWeight="bold"
              color="white"
              fontFamily="monospace"
              textShadow="1px 1px 0px #000"
            >
              マスター音量
            </Text>
            <Text fontSize="sm" color={UI_TOKENS.COLORS.whiteAlpha80} fontFamily="monospace">
              {displayVolume}%
            </Text>
          </HStack>
          <Box
            mt={3}
            h="10px"
            borderRadius={0}
            border="1px solid"
            borderColor={UI_TOKENS.COLORS.whiteAlpha30}
            bg={UI_TOKENS.COLORS.whiteAlpha05}
            position="relative"
            overflow="hidden"
          >
            <Box
              position="absolute"
              insetY={0}
              left={0}
              width={`${displayVolume}%`}
              bg="rgba(255,255,255,0.8)"
            />
          </Box>
          <Text
            fontSize="xs"
            color={UI_TOKENS.COLORS.textMuted}
            fontFamily="monospace"
            mt={2}
          >
            ぜんたいの おとの おおきさ
          </Text>
        </Box>

        <Box
          p={4}
          borderRadius={0}
          border="2px solid"
          borderColor={UI_TOKENS.COLORS.whiteAlpha30}
          bg={UI_TOKENS.COLORS.panelBg}
          boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
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
                サウンド有効化
              </Text>
              <Text
                fontSize="xs"
                color={UI_TOKENS.COLORS.textMuted}
                fontFamily="monospace"
                lineHeight="short"
              >
                サウンド ON/OFF
              </Text>
            </VStack>
            <Box
              minW="72px"
              px={3}
              py={1}
              border="2px solid"
              borderColor={muted ? UI_TOKENS.COLORS.whiteAlpha60 : UI_TOKENS.COLORS.whiteAlpha90}
              bg={muted ? UI_TOKENS.COLORS.whiteAlpha10 : UI_TOKENS.COLORS.whiteAlpha15}
              color="white"
              fontFamily="monospace"
              fontWeight="bold"
              textAlign="center"
            >
              {muted ? "OFF" : "ON"}
            </Box>
          </HStack>
        </Box>

        <Box
          p={4}
          borderRadius={0}
          border="2px solid"
          borderColor={UI_TOKENS.COLORS.whiteAlpha30}
          bg={UI_TOKENS.COLORS.panelBg}
          boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
        >
          <Text
            fontSize="sm"
            fontWeight="bold"
            color="white"
            fontFamily="monospace"
            textShadow="1px 1px 0px #000"
            mb={2}
          >
            予定しているサウンドスロット
          </Text>
          <Stack gap={1} fontFamily="monospace">
            {SOUND_SLOTS.map((key) => (
              <HStack
                key={key}
                justify="flex-start"
                gap={2}
                color={UI_TOKENS.COLORS.whiteAlpha80}
              >
                <Box
                  w={2}
                  h={2}
                  borderRadius={0}
                  bg={UI_TOKENS.COLORS.whiteAlpha20}
                  border="1px solid"
                  borderColor={UI_TOKENS.COLORS.whiteAlpha40}
                />
                <Text fontSize="xs">{key}</Text>
              </HStack>
            ))}
          </Stack>
        </Box>
      </Stack>

      <Text
        fontSize="xs"
        color={UI_TOKENS.COLORS.textMuted}
        fontFamily="monospace"
        textAlign="center"
      >
        音声準備に苦戦しています ☕
      </Text>
    </Stack>
  );
}

export default SoundSettingsPlaceholder;
