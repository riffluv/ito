"use client";
import { Box, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { useSoundManager, useSoundSettings } from "@/lib/audio/SoundProvider";
import { useCallback, useEffect, useMemo, useState } from "react";

type AdjustableCategory = "ambient" | "notify" | "ui" | "fanfare";

export function SoundSettingsPanel() {
  const soundManager = useSoundManager();
  const soundSettings = useSoundSettings();

  const snapshot = useMemo(
    () => soundManager?.getSettings() ?? soundSettings,
    [soundManager, soundSettings]
  );

  const [masterVolume, setMasterVolume] = useState(snapshot.masterVolume);
  const [muted, setMuted] = useState(snapshot.muted);
  const [bgmVolume, setBgmVolume] = useState(snapshot.categoryVolume.ambient);
  const [sfxVolume, setSfxVolume] = useState(snapshot.categoryVolume.ui);
  const [notifyVolume, setNotifyVolume] = useState(snapshot.categoryVolume.notify);
  const [fanfareVolume, setFanfareVolume] = useState(
    snapshot.categoryVolume.fanfare ?? 1
  );
  const [successMode, setSuccessMode] = useState(snapshot.successMode);

  const syncFromSettings = useCallback(() => {
    const current = soundManager?.getSettings() ?? soundSettings;
    setMasterVolume(current.masterVolume);
    setMuted(current.muted);
    setBgmVolume(current.categoryVolume.ambient);
    setSfxVolume(current.categoryVolume.ui);
    setNotifyVolume(current.categoryVolume.notify);
    setFanfareVolume(current.categoryVolume.fanfare ?? 1);
    setSuccessMode(current.successMode);
  }, [soundManager, soundSettings]);

  useEffect(() => {
    syncFromSettings();
  }, [syncFromSettings]);

  const applyMasterVolume = (value: number) => {
    setMasterVolume(value);
    soundManager?.setMasterVolume(value);
  };

  const applyMuted = (next: boolean) => {
    setMuted(next);
    soundManager?.setMuted(next);
  };

  const applyCategoryVolume = (category: AdjustableCategory, value: number) => {
    if (!soundManager) return;
    if (category === "ambient") {
      soundManager.setCategoryVolume("ambient", value);
      return;
    }

    if (category === "ui") {
      soundManager.setCategoryVolume("ui", value);
      soundManager.setCategoryVolume("card", value);
      soundManager.setCategoryVolume("drag", value);
      return;
    }

    if (category === "notify") {
      soundManager.setCategoryVolume("notify", value);
      soundManager.setCategoryVolume("system", value);
      return;
    }

    if (category === "fanfare") {
      soundManager.setCategoryVolume("fanfare", value);
      return;
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
        "効果音音量",
        sfxVolume,
        (value) => {
          setSfxVolume(value);
          applyCategoryVolume("ui", value);
        },
        "カード操作やドラッグなどのサウンド",
      )}

      {renderSlider(
        "通知音量",
        notifyVolume,
        (value) => {
          setNotifyVolume(value);
          applyCategoryVolume("notify", value);
        },
        "トーストやシステム通知の音に影響します",
      )}

      {renderSlider(
        "ファンファーレ音量",
        fanfareVolume,
        (value) => {
          setFanfareVolume(value);
          applyCategoryVolume("fanfare", value);
        },
        "ラウンド開始や勝利演出のファンファーレ",
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
              },
              {
                mode: "epic" as const,
                title: "エピック",
              },
            ].map(({ mode, title }) => {
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
