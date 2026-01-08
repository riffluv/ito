"use client";

import { UI_TOKENS } from "@/theme/layout";
import { Box, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import {
  MODE_OPTIONS,
  TOPIC_TYPE_OPTIONS,
} from "@/components/settings/settingsModalModel";

export function SettingsModalGameTab(props: {
  resolveMode: string;
  onResolveModeChange: (next: string) => void;
  defaultTopicType: string;
  onDefaultTopicTypeChange: (next: string) => void;
  isHost: boolean;
  roomStatus: string;
  supportToolsEnabled: boolean;
  supportCopying: boolean;
  onCopySupportLog: () => void;
}) {
  const {
    resolveMode,
    onResolveModeChange,
    defaultTopicType,
    onDefaultTopicTypeChange,
    isHost,
    roomStatus,
    supportToolsEnabled,
    supportCopying,
    onCopySupportLog,
  } = props;

  return (
    <Stack gap={6}>
      <Box>
        <Text fontSize="sm" fontWeight="600" color="gray.300" mb={3}>
          どうやって あそぶか
        </Text>
        <Stack gap={2}>
          {MODE_OPTIONS.map((option) => {
            const isSelected = resolveMode === option.value;
            return (
              <Box
                key={option.value}
                cursor="pointer"
                onClick={() => onResolveModeChange(option.value)}
                p={4}
                borderRadius="0"
                border="2px solid"
                borderColor={
                  isSelected
                    ? UI_TOKENS.COLORS.whiteAlpha90
                    : UI_TOKENS.COLORS.whiteAlpha30
                }
                bg={
                  isSelected
                    ? UI_TOKENS.COLORS.whiteAlpha10
                    : UI_TOKENS.COLORS.panelBg
                }
                transition={`background-color 177ms cubic-bezier(.2,1,.3,1), border-color 177ms cubic-bezier(.2,1,.3,1), box-shadow 177ms cubic-bezier(.2,1,.3,1)`}
                boxShadow={
                  isSelected
                    ? UI_TOKENS.SHADOWS.panelDistinct
                    : UI_TOKENS.SHADOWS.panelSubtle
                }
                _hover={{
                  borderColor: UI_TOKENS.COLORS.whiteAlpha80,
                  bg: isSelected
                    ? UI_TOKENS.COLORS.whiteAlpha15
                    : UI_TOKENS.COLORS.panelBg,
                }}
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
                      {option.title}
                    </Text>
                    <Text
                      fontSize="sm"
                      color={UI_TOKENS.COLORS.textMuted}
                      lineHeight="short"
                      fontFamily="monospace"
                    >
                      {option.description}
                    </Text>
                  </VStack>
                  <Box
                    w={5}
                    h={5}
                    borderRadius="0"
                    border="2px solid"
                    borderColor={
                      isSelected ? "white" : UI_TOKENS.COLORS.whiteAlpha50
                    }
                    bg={isSelected ? "white" : "transparent"}
                    mt={0.5}
                    position="relative"
                    transition={`background-color 177ms cubic-bezier(.2,1,.3,1), border-color 177ms cubic-bezier(.2,1,.3,1)`}
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
      </Box>

      <Box>
        <Text fontSize="sm" fontWeight="600" color="gray.300" mb={3}>
          おだいの しゅるい
        </Text>
        <Stack gap={2}>
          {TOPIC_TYPE_OPTIONS.map((option) => {
            const isSelected = defaultTopicType === option.value;
            return (
              <Box
                key={option.value}
                cursor="pointer"
                onClick={() => onDefaultTopicTypeChange(option.value)}
                p={4}
                borderRadius="0"
                border="2px solid"
                borderColor={
                  isSelected
                    ? UI_TOKENS.COLORS.whiteAlpha90
                    : UI_TOKENS.COLORS.whiteAlpha30
                }
                bg={
                  isSelected
                    ? UI_TOKENS.COLORS.whiteAlpha10
                    : UI_TOKENS.COLORS.panelBg
                }
                transition={`background-color 177ms cubic-bezier(.2,1,.3,1), border-color 177ms cubic-bezier(.2,1,.3,1), box-shadow 177ms cubic-bezier(.2,1,.3,1)`}
                boxShadow={
                  isSelected
                    ? UI_TOKENS.SHADOWS.panelDistinct
                    : UI_TOKENS.SHADOWS.panelSubtle
                }
                _hover={{
                  borderColor: UI_TOKENS.COLORS.whiteAlpha80,
                  bg: isSelected
                    ? UI_TOKENS.COLORS.whiteAlpha15
                    : UI_TOKENS.COLORS.panelBg,
                }}
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
                      {option.title}
                    </Text>
                    <Text
                      fontSize="sm"
                      color={UI_TOKENS.COLORS.textMuted}
                      lineHeight="short"
                      fontFamily="monospace"
                    >
                      {option.description}
                    </Text>
                  </VStack>
                  <Box
                    w={5}
                    h={5}
                    borderRadius="0"
                    border="2px solid"
                    borderColor={
                      isSelected ? "white" : UI_TOKENS.COLORS.whiteAlpha50
                    }
                    bg={isSelected ? "white" : "transparent"}
                    mt={0.5}
                    position="relative"
                    transition={`background-color 177ms cubic-bezier(.2,1,.3,1), border-color 177ms cubic-bezier(.2,1,.3,1)`}
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
      </Box>

      {(!isHost || roomStatus !== "waiting") && (
        <Box
          p={4}
          bg={UI_TOKENS.COLORS.whiteAlpha05}
          borderRadius="0"
          border="2px solid"
          borderColor={UI_TOKENS.COLORS.whiteAlpha60}
          boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
        >
          <Text
            fontSize="sm"
            color={UI_TOKENS.COLORS.textMuted}
            textAlign="center"
            fontFamily="monospace"
          >
            {!isHost
              ? "せっていは ホストのみ かえられます"
              : "せっていは たいきちゅうのみ かえられます"}
          </Text>
        </Box>
      )}

      {supportToolsEnabled && (
        <Box
          p={4}
          bg={UI_TOKENS.COLORS.whiteAlpha05}
          borderRadius="0"
          border="2px solid"
          borderColor={UI_TOKENS.COLORS.whiteAlpha60}
          boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
        >
          <VStack align="start" gap={2}>
            <Text
              fontSize="sm"
              fontWeight="600"
              color="gray.300"
              fontFamily="monospace"
            >
              サポート用ログ
            </Text>
            <Text
              fontSize="xs"
              color={UI_TOKENS.COLORS.textMuted}
              fontFamily="monospace"
            >
              不具合調査用の診断ログを1クリックでコピーします。
            </Text>
            <HStack gap={3}>
              <Box
                as="button"
                onClick={onCopySupportLog}
                px={4}
                py={2}
                borderRadius="0"
                border="2px solid"
                borderColor={UI_TOKENS.COLORS.whiteAlpha90}
                bg={UI_TOKENS.COLORS.whiteAlpha10}
                color="white"
                fontFamily="monospace"
                fontWeight="bold"
                cursor={supportCopying ? "not-allowed" : "pointer"}
                opacity={supportCopying ? 0.6 : 1}
                pointerEvents={supportCopying ? "none" : "auto"}
                transition={`background-color 117ms cubic-bezier(.2,1,.3,1), border-color 117ms cubic-bezier(.2,1,.3,1)`}
                _hover={{
                  borderColor: UI_TOKENS.COLORS.whiteAlpha80,
                  bg: UI_TOKENS.COLORS.whiteAlpha15,
                }}
              >
                診断ログをコピー
              </Box>
            </HStack>
          </VStack>
        </Box>
      )}
    </Stack>
  );
}

