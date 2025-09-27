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
          borderColor={UI_TOKENS.COLORS.whiteAlpha80}
          bg={UI_TOKENS.GRADIENTS.deepBlue}
          p={6}
          borderRadius={0}
          position="relative"
          textAlign="center"
          boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
          _hover={{ borderColor: UI_TOKENS.COLORS.whiteAlpha90 }}
        >
          <Box
            position="absolute"
            insetX={0}
            top={0}
            h="4px"
            bg="linear-gradient(90deg, rgba(255,215,128,0.85), rgba(99,102,241,0.35))"
          />
          <Text
            fontSize="lg"
            fontWeight="bold"
            color="white"
            fontFamily="monospace"
            textShadow="1px 1px 0px #000"
            mb={2}
          >
            サウンドシステム 準備中
          </Text>
          <Text
            fontSize="sm"
            color={UI_TOKENS.COLORS.textMuted}
            fontFamily="monospace"
            lineHeight="short"
          >
            サウンド素材を制作中です。ファイルが揃い次第、この画面で音量やミュートを設定できます。
          </Text>
          <Text
            fontSize="xs"
            color={UI_TOKENS.COLORS.whiteAlpha80}
            fontFamily="monospace"
            mt={3}
          >
            ※ 現在はプレビューのみ有効です
          </Text>
          <Text
            fontSize="xs"
            color={UI_TOKENS.COLORS.whiteAlpha60}
            fontFamily="monospace"
            mt={1}
          >
            サウンドマネージャー: {managerStatus}
          </Text>
          {locked && (
            <Box
              mt={4}
              display="inline-block"
              px={3}
              py={1}
              border="2px solid"
              borderColor={UI_TOKENS.COLORS.whiteAlpha80}
              color={UI_TOKENS.COLORS.whiteAlpha80}
              fontFamily="monospace"
              fontSize="sm"
              letterSpacing="0.12em"
            >
              Coming Soon
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
              bg="linear-gradient(90deg, rgba(255,215,0,0.85), rgba(139,92,246,0.65))"
            />
          </Box>
          <Text
            fontSize="xs"
            color={UI_TOKENS.COLORS.textMuted}
            fontFamily="monospace"
            mt={2}
          >
            後日追加される効果音やBGMのバランスをここで整えられる予定です。
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
                効果音を一括でオン／オフする切り替えをここに追加する予定です。
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
        音声ファイルを配置するときは public/sfx 配下にフォルダを作成し、ファイル名を上記スロットと合わせてください。
      </Text>
    </Stack>
  );
}

export default SoundSettingsPlaceholder;
