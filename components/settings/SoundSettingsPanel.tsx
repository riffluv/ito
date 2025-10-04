"use client";
import { Box, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { useSoundManager, useSoundSettings } from "@/lib/audio/SoundProvider";
import { useEffect, useState } from "react";

export function SoundSettingsPanel() {
  const soundManager = useSoundManager();
  const soundSettings = useSoundSettings();

  const [masterVolume, setMasterVolume] = useState(soundSettings.masterVolume);
  const [muted, setMuted] = useState(soundSettings.muted);
  const [bgmVolume, setBgmVolume] = useState(soundSettings.categoryVolume.ambient);
  const [systemVolume, setSystemVolume] = useState(soundSettings.categoryVolume.system);
  const [sfxVolume, setSfxVolume] = useState(soundSettings.categoryVolume.ui);
  const [successMode, setSuccessMode] = useState(soundSettings.successMode);

  useEffect(() => {
    setMasterVolume(soundSettings.masterVolume);
    setMuted(soundSettings.muted);
    setBgmVolume(soundSettings.categoryVolume.ambient);
    setSystemVolume(soundSettings.categoryVolume.system);
    setSfxVolume(soundSettings.categoryVolume.ui);
    setSuccessMode(soundSettings.successMode);
  }, [
    soundSettings.masterVolume,
    soundSettings.muted,
    soundSettings.categoryVolume.ambient,
    soundSettings.categoryVolume.system,
    soundSettings.categoryVolume.ui,
    soundSettings.successMode,
  ]);

  const applyMasterVolume = (value: number) => {
    setMasterVolume(value);
    soundManager?.setMasterVolume(value);
  };

  const applyMuted = (next: boolean) => {
    setMuted(next);
    soundManager?.setMuted(next);
  };

  const applyCategoryVolume = (
    category: "ambient" | "system" | "ui",
    value: number,
  ) => {
    if (!soundManager) return;
    if (category === "ambient") {
      soundManager.setCategoryVolume("ambient", value);
    } else if (category === "system") {
      soundManager.setCategoryVolume("system", value);
      soundManager.setCategoryVolume("result", value);
      soundManager.setCategoryVolume("notify", value);
    } else if (category === "ui") {
      soundManager.setCategoryVolume("ui", value);
      soundManager.setCategoryVolume("card", value);
      soundManager.setCategoryVolume("drag", value);
    }
  };

  const applySuccessMode = (mode: typeof successMode) => {
    setSuccessMode(mode);
    soundManager?.setSuccessMode(mode);
  };

  const renderSlider = (
    label: string,
    value: number,
    onChange: (val: number) => void,
    hint?: string,
  ) => (
    <Box>
      <HStack justify="space-between" mb={2}>
        <Text fontWeight="bold" fontSize="sm" fontFamily="monospace">
          {label}
        </Text>
        <Text fontSize="sm" opacity={0.8} fontFamily="monospace">
          {Math.round(value * 100)}%
        </Text>
      </HStack>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value))}
        style={{
          width: "100%",
          accentColor: UI_TOKENS.COLORS.dqGold,
        }}
      />
      {hint ? (
        <Text
          fontSize="xs"
          color={UI_TOKENS.COLORS.textMuted}
          mt={1}
          fontFamily="monospace"
        >
          {hint}
        </Text>
      ) : null}
    </Box>
  );

  return (
    <Stack gap={6} color="white" fontFamily="monospace">
      {renderSlider("全体音量", masterVolume, (value) => applyMasterVolume(value))}

      <HStack justify="space-between">
        <Text fontWeight="bold" fontSize="sm">
          ミュート
        </Text>
        <Box
          as="button"
          onClick={() => applyMuted(!muted)}
          px={4}
          py={1}
          bg={muted ? UI_TOKENS.COLORS.dqGold : "gray.700"}
          color={muted ? "black" : "white"}
          borderRadius={0}
          border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          fontWeight="bold"
          fontSize="sm"
          cursor="pointer"
          transition="all 0.2s"
          _hover={{ opacity: 0.85 }}
        >
          {muted ? "ON" : "OFF"}
        </Box>
      </HStack>

      {renderSlider("BGM音量", bgmVolume, (value) => {
        setBgmVolume(value);
        applyCategoryVolume("ambient", value);
      })}

      {renderSlider(
        "演出サウンド音量",
        systemVolume,
        (value) => {
          setSystemVolume(value);
          applyCategoryVolume("system", value);
        },
        "リザルトや通知のファンファーレも一緒に調整されます",
      )}

      {renderSlider(
        "効果音音量",
        sfxVolume,
        (value) => {
          setSfxVolume(value);
          applyCategoryVolume("ui", value);
        },
        "カード操作やドラッグの効果音に影響します",
      )}

      <Box
        border="2px solid"
        borderColor={UI_TOKENS.COLORS.whiteAlpha30}
        bg={UI_TOKENS.COLORS.panelBg}
        boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
        p={4}
        borderRadius={0}
      >
        <VStack align="stretch" gap={3}>
          <Text fontWeight="bold" fontSize="sm">
            勝利ファンファーレ
          </Text>
          <HStack gap={3} flexWrap="wrap">
            {[
              {
                mode: "normal" as const,
                title: "ノーマル",
                description: "",
              },
              {
                mode: "epic" as const,
                title: "エピック",
                description: "",
              },
            ].map(({ mode, title, description }) => {
              const active = successMode === mode;
              return (
                <Box
                  key={mode}
                  as="button"
                  onClick={() => applySuccessMode(mode)}
                  px={4}
                  py={3}
                  borderRadius={0}
                  border="2px solid"
                  borderColor={
                    active
                      ? UI_TOKENS.COLORS.whiteAlpha90
                      : UI_TOKENS.COLORS.whiteAlpha40
                  }
                  bg={
                    active
                      ? UI_TOKENS.COLORS.dqGold
                      : UI_TOKENS.COLORS.whiteAlpha10
                  }
                  color={active ? UI_TOKENS.COLORS.panelBg : "white"}
                  minW="140px"
                  textAlign="left"
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{ opacity: 0.9 }}
                >
                  <Text fontWeight="bold" fontSize="sm">
                    {title}
                  </Text>
                </Box>
              );
            })}
          </HStack>
        </VStack>
      </Box>

    </Stack>
  );
}
