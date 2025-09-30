"use client";
import { Box, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { useSoundManager, useSoundSettings } from "@/lib/audio/SoundProvider";
import type { SoundCategory } from "@/lib/audio/types";
import { useState, useCallback, useEffect } from "react";

const CATEGORY_LABELS: Record<SoundCategory, string> = {
  ui: "UI・ボタン音",
  card: "カード音",
  notify: "通知音",
  result: "結果音",
  drag: "ドラッグ音",
  system: "システム音",
  ambient: "環境音",
};

const CATEGORY_ORDER: SoundCategory[] = [
  "ui",
  "card",
  "notify",
  "result",
  "drag",
  "system",
  "ambient",
];

type SoundSettingsPanelProps = {
  previewMuted: boolean;
  previewMasterVolume: number;
  onMutedChange: (muted: boolean) => void;
  onMasterVolumeChange: (volume: number) => void;
};

export function SoundSettingsPanel({
  previewMuted,
  previewMasterVolume,
  onMutedChange,
  onMasterVolumeChange,
}: SoundSettingsPanelProps) {
  const soundManager = useSoundManager();
  const soundSettings = useSoundSettings();
  const [categoryVolumes, setCategoryVolumes] = useState(
    soundSettings.categoryVolume
  );

  // Sync with global settings when they change
  useEffect(() => {
    setCategoryVolumes(soundSettings.categoryVolume);
  }, [soundSettings.categoryVolume]);

  const handleMasterVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      onMasterVolumeChange(newVolume);
      soundManager?.setMasterVolume(newVolume);
    },
    [onMasterVolumeChange, soundManager]
  );

  const handleMuteToggle = useCallback(() => {
    const newMuted = !previewMuted;
    onMutedChange(newMuted);
    soundManager?.setMuted(newMuted);
  }, [previewMuted, onMutedChange, soundManager]);

  const handleCategoryVolumeChange = useCallback(
    (category: SoundCategory, volume: number) => {
      const newCategoryVolume = { ...categoryVolumes, [category]: volume };
      setCategoryVolumes(newCategoryVolume);
      soundManager?.setCategoryVolume(category, volume);
    },
    [categoryVolumes, soundManager]
  );

  const handleTestSound = useCallback(
    (category: SoundCategory) => {
      // Test sounds for each category
      const testSounds: Partial<Record<SoundCategory, string>> = {
        ui: "ui_click",
        card: "card_slide",
        notify: "notify_success",
        result: "result_victory",
        drag: "drag_pickup",
        system: "round_start",
      };
      const soundId = testSounds[category];
      if (soundId && soundManager) {
        soundManager.play(soundId as any);
      }
    },
    [soundManager]
  );

  const displayMasterVolume = Math.round(previewMasterVolume * 100);

  return (
    <Stack gap={5}>
      {/* Master Volume Control */}
      <Box
        p={4}
        borderRadius={0}
        border="2px solid"
        borderColor={UI_TOKENS.COLORS.whiteAlpha30}
        bg={UI_TOKENS.COLORS.panelBg}
        boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
        transition={`border-color 0.15s ${UI_TOKENS.EASING.standard}`}
        _hover={{
          borderColor: UI_TOKENS.COLORS.whiteAlpha50,
        }}
      >
        <HStack justify="space-between" align="center" mb={3}>
          <Text
            fontSize="md"
            fontWeight="bold"
            color="white"
            fontFamily="monospace"
            textShadow="1px 1px 0px #000"
          >
            マスター音量
          </Text>
          <Text
            fontSize="md"
            color="white"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {displayMasterVolume}%
          </Text>
        </HStack>
        <Box position="relative">
          <style jsx>{`
            .master-slider::-webkit-slider-thumb {
              appearance: none;
              width: 20px;
              height: 20px;
              background: white;
              border: 2px solid ${UI_TOKENS.COLORS.whiteAlpha80};
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
            }
            .master-slider::-moz-range-thumb {
              width: 18px;
              height: 18px;
              background: white;
              border: 2px solid ${UI_TOKENS.COLORS.whiteAlpha80};
              cursor: pointer;
              border-radius: 0;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
            }
          `}</style>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={previewMasterVolume}
            onChange={handleMasterVolumeChange}
            className="master-slider"
            style={{
              width: "100%",
              height: "12px",
              appearance: "none",
              background: `linear-gradient(to right, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.85) ${displayMasterVolume}%, rgba(255,255,255,0.15) ${displayMasterVolume}%, rgba(255,255,255,0.15) 100%)`,
              border: `2px solid ${UI_TOKENS.COLORS.whiteAlpha40}`,
              cursor: "pointer",
              outline: "none",
            }}
          />
        </Box>
        <Text
          fontSize="xs"
          color={UI_TOKENS.COLORS.textMuted}
          fontFamily="monospace"
          mt={2}
          textAlign="center"
        >
          ぜんたいの おとの おおきさ
        </Text>
      </Box>

      {/* Mute Toggle */}
      <Box
        p={4}
        borderRadius={0}
        border="2px solid"
        borderColor={UI_TOKENS.COLORS.whiteAlpha30}
        bg={UI_TOKENS.COLORS.panelBg}
        boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
        transition={`border-color 0.15s ${UI_TOKENS.EASING.standard}`}
        _hover={{
          borderColor: UI_TOKENS.COLORS.whiteAlpha50,
        }}
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
              すべての おとを ON/OFF
            </Text>
          </VStack>
          <Box
            as="button"
            minW="80px"
            px={4}
            py={2}
            border="2px solid"
            borderColor={
              previewMuted
                ? UI_TOKENS.COLORS.whiteAlpha40
                : UI_TOKENS.COLORS.whiteAlpha90
            }
            bg={
              previewMuted
                ? UI_TOKENS.COLORS.whiteAlpha10
                : UI_TOKENS.COLORS.whiteAlpha20
            }
            color="white"
            fontFamily="monospace"
            fontWeight="bold"
            textAlign="center"
            cursor="pointer"
            transition={`all 0.15s ${UI_TOKENS.EASING.standard}`}
            _hover={{
              bg: previewMuted
                ? UI_TOKENS.COLORS.whiteAlpha15
                : UI_TOKENS.COLORS.whiteAlpha20,
              borderColor: UI_TOKENS.COLORS.whiteAlpha90,
            }}
            _active={{
              transform: "scale(0.96)",
            }}
            onClick={handleMuteToggle}
          >
            {previewMuted ? "OFF" : "ON"}
          </Box>
        </HStack>
      </Box>

      {/* Category Volume Controls */}
      <Box
        p={4}
        borderRadius={0}
        border="2px solid"
        borderColor={UI_TOKENS.COLORS.whiteAlpha30}
        bg={UI_TOKENS.COLORS.panelBg}
        boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
      >
        <Text
          fontSize="md"
          fontWeight="bold"
          color="white"
          fontFamily="monospace"
          textShadow="1px 1px 0px #000"
          mb={4}
        >
          カテゴリー別 音量
        </Text>
        <Stack gap={4}>
          {CATEGORY_ORDER.map((category) => {
            const volume = categoryVolumes[category];
            const displayVolume = Math.round(volume * 100);
            return (
              <Box
                key={category}
                p={3}
                borderRadius={0}
                border="1px solid"
                borderColor={UI_TOKENS.COLORS.whiteAlpha20}
                bg={UI_TOKENS.COLORS.whiteAlpha05}
                transition={`all 0.15s ${UI_TOKENS.EASING.standard}`}
                _hover={{
                  borderColor: UI_TOKENS.COLORS.whiteAlpha40,
                  bg: UI_TOKENS.COLORS.whiteAlpha10,
                }}
              >
                <HStack justify="space-between" align="center" mb={2}>
                  <Text
                    fontSize="sm"
                    fontWeight="bold"
                    color="white"
                    fontFamily="monospace"
                    flex="1"
                  >
                    {CATEGORY_LABELS[category]}
                  </Text>
                  <HStack gap={2}>
                    <Text
                      fontSize="xs"
                      color={UI_TOKENS.COLORS.whiteAlpha80}
                      fontFamily="monospace"
                      minW="35px"
                      textAlign="right"
                    >
                      {displayVolume}%
                    </Text>
                    <Box
                      as="button"
                      px={2}
                      py={1}
                      fontSize="xs"
                      border="1px solid"
                      borderColor={UI_TOKENS.COLORS.whiteAlpha60}
                      bg={UI_TOKENS.COLORS.whiteAlpha10}
                      color="white"
                      fontFamily="monospace"
                      fontWeight="bold"
                      cursor="pointer"
                      transition={`all 0.15s ${UI_TOKENS.EASING.standard}`}
                      _hover={{
                        bg: UI_TOKENS.COLORS.whiteAlpha20,
                        borderColor: UI_TOKENS.COLORS.whiteAlpha90,
                      }}
                      _active={{
                        transform: "scale(0.95)",
                      }}
                      onClick={() => handleTestSound(category)}
                    >
                      TEST
                    </Box>
                  </HStack>
                </HStack>
                <style jsx>{`
                  .category-slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    background: white;
                    border: 2px solid ${UI_TOKENS.COLORS.whiteAlpha60};
                    cursor: pointer;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
                  }
                  .category-slider::-moz-range-thumb {
                    width: 14px;
                    height: 14px;
                    background: white;
                    border: 2px solid ${UI_TOKENS.COLORS.whiteAlpha60};
                    cursor: pointer;
                    border-radius: 0;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
                  }
                `}</style>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) =>
                    handleCategoryVolumeChange(
                      category,
                      parseFloat(e.target.value)
                    )
                  }
                  className="category-slider"
                  style={{
                    width: "100%",
                    height: "8px",
                    appearance: "none",
                    background: `linear-gradient(to right, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.7) ${displayVolume}%, rgba(255,255,255,0.1) ${displayVolume}%, rgba(255,255,255,0.1) 100%)`,
                    border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
                    cursor: "pointer",
                    outline: "none",
                  }}
                />
              </Box>
            );
          })}
        </Stack>
      </Box>

      <Text
        fontSize="xs"
        color={UI_TOKENS.COLORS.textMuted}
        fontFamily="monospace"
        textAlign="center"
        mt={2}
      >
        ※ せっていは じどうてきに ほぞんされます
      </Text>
    </Stack>
  );
}

export default SoundSettingsPanel;