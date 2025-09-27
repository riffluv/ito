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
          border="3px solid"
          borderColor={UI_TOKENS.COLORS.whiteAlpha90}
          bg="rgba(8, 9, 15, 0.95)"
          p={6}
          borderRadius={0}
          position="relative"
          textAlign="center"
          boxShadow={`
            inset 0 2px 0 rgba(255,255,255,0.1),
            inset 0 -2px 0 rgba(0,0,0,0.4),
            0 4px 8px rgba(0,0,0,0.3),
            1px 1px 0 rgba(0,0,0,0.7),
            0 2px 0 rgba(0,0,0,0.5)
          `}
          _hover={{
            borderColor: "rgba(255,215,0,0.8)",
            boxShadow: `
              inset 0 2px 0 rgba(255,255,255,0.15),
              inset 0 -2px 0 rgba(0,0,0,0.5),
              0 6px 12px rgba(0,0,0,0.4),
              1px 1px 0 rgba(0,0,0,0.8),
              0 3px 0 rgba(0,0,0,0.6)
            `
          }}
        >
          <Box
            position="absolute"
            insetX={0}
            top={0}
            h="3px"
            bg="linear-gradient(90deg, rgba(255,215,0,0.9), rgba(255,140,0,0.6))"
          />
          <Text
            fontSize="xl"
            fontWeight="700"
            color="white"
            fontFamily="monospace"
            textShadow="2px 2px 0px rgba(0,0,0,0.8)"
            mb={3}
            letterSpacing="1px"
          >
            サウンド設定
          </Text>
          <Text
            fontSize="md"
            color="rgba(255,215,128,0.95)"
            fontFamily="monospace"
            lineHeight="1.6"
            fontWeight="600"
            textShadow="1px 1px 0px rgba(0,0,0,0.7)"
          >
            音作ってるから待ってて！
          </Text>
          {locked && (
            <Box
              mt={4}
              display="inline-block"
              px={4}
              py={2}
              border="3px solid"
              borderColor="rgba(255,215,0,0.8)"
              bg="rgba(255,215,0,0.1)"
              color="rgba(255,215,0,0.95)"
              fontFamily="monospace"
              fontSize="sm"
              fontWeight="700"
              letterSpacing="1px"
              textShadow="1px 1px 0px rgba(0,0,0,0.8)"
              boxShadow={`
                inset 0 1px 0 rgba(255,255,255,0.1),
                0 2px 4px rgba(0,0,0,0.3)
              `}
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
            color="rgba(255,215,128,0.8)"
            fontFamily="monospace"
            mt={2}
            fontWeight="500"
            textShadow="1px 1px 0px rgba(0,0,0,0.6)"
          >
            🎭 いずれ効果音や音楽の調整ができるようになるよ！
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
                color="rgba(255,215,128,0.8)"
                fontFamily="monospace"
                lineHeight="short"
                fontWeight="500"
                textShadow="1px 1px 0px rgba(0,0,0,0.6)"
              >
                🔊 音を鳴らすか鳴らさないかの設定がここに来るよ！
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
        color="rgba(255,215,128,0.7)"
        fontFamily="monospace"
        textAlign="center"
        fontWeight="500"
        fontStyle="italic"
        textShadow="1px 1px 0px rgba(0,0,0,0.6)"
      >
        音声準備に苦戦しています ☕
      </Text>
    </Stack>
  );
}

export default SoundSettingsPlaceholder;
