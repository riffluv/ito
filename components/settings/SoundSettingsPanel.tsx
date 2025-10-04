"use client";
import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { useSoundManager, useSoundSettings } from "@/lib/audio/SoundProvider";
import { useState, useCallback, useEffect, useRef } from "react";

type SoundSettingsPanelProps = {
  isModalOpen: boolean;
  previewMuted: boolean;
  previewMasterVolume: number;
  onMutedChange: (muted: boolean) => void;
  onMasterVolumeChange: (volume: number) => void;
  onDraftStateChange?: (isDirty: boolean) => void;
  registerActions?: (actions: {
    save: () => void;
    cancel: () => void;
  }) => void;
};

export function SoundSettingsPanel({
  isModalOpen,
  previewMuted,
  previewMasterVolume,
  onMutedChange,
  onMasterVolumeChange,
  onDraftStateChange,
  registerActions,
}: SoundSettingsPanelProps) {
  const soundManager = useSoundManager();
  const soundSettings = useSoundSettings();

  // Draft state for all settings
  const [draftMasterVolume, setDraftMasterVolume] = useState(soundSettings.masterVolume);
  const [draftMuted, setDraftMuted] = useState(soundSettings.muted);
  const [draftBgmVolume, setDraftBgmVolume] = useState(soundSettings.categoryVolume.ambient);
  const [draftSystemVolume, setDraftSystemVolume] = useState(soundSettings.categoryVolume.system);
  const [draftSfxVolume, setDraftSfxVolume] = useState(soundSettings.categoryVolume.ui);

  const prevIsOpenRef = useRef(false);

  // Reset draft when modal opens
  useEffect(() => {
    if (isModalOpen && !prevIsOpenRef.current) {
      setDraftMasterVolume(soundSettings.masterVolume);
      setDraftMuted(soundSettings.muted);
      setDraftBgmVolume(soundSettings.categoryVolume.ambient);
      setDraftSystemVolume(soundSettings.categoryVolume.system);
      setDraftSfxVolume(soundSettings.categoryVolume.ui);
    }
    prevIsOpenRef.current = isModalOpen;
  }, [isModalOpen, soundSettings]);

  // Check if draft is dirty
  const isDirty =
    draftMasterVolume !== soundSettings.masterVolume ||
    draftMuted !== soundSettings.muted ||
    draftBgmVolume !== soundSettings.categoryVolume.ambient ||
    draftSystemVolume !== soundSettings.categoryVolume.system ||
    draftSfxVolume !== soundSettings.categoryVolume.ui;

  useEffect(() => {
    onDraftStateChange?.(isDirty);
  }, [isDirty, onDraftStateChange]);

  const handleSave = useCallback(() => {
    if (!soundManager) return;

    // Apply all changes at once
    const currentSettings = soundManager.getSettings();

    if (currentSettings.masterVolume !== draftMasterVolume) {
      soundManager.setMasterVolume(draftMasterVolume);
    }
    if (currentSettings.muted !== draftMuted) {
      soundManager.setMuted(draftMuted);
    }
    if (currentSettings.categoryVolume.ambient !== draftBgmVolume) {
      soundManager.setCategoryVolume("ambient", draftBgmVolume);
    }
    if (currentSettings.categoryVolume.system !== draftSystemVolume) {
      soundManager.setCategoryVolume("system", draftSystemVolume);
      soundManager.setCategoryVolume("result", draftSystemVolume);
      soundManager.setCategoryVolume("notify", draftSystemVolume);
    }
    if (currentSettings.categoryVolume.ui !== draftSfxVolume) {
      soundManager.setCategoryVolume("ui", draftSfxVolume);
      soundManager.setCategoryVolume("card", draftSfxVolume);
      soundManager.setCategoryVolume("drag", draftSfxVolume);
    }

    // Update preview state
    onMasterVolumeChange(draftMasterVolume);
    onMutedChange(draftMuted);
  }, [
    soundManager,
    draftMasterVolume,
    draftMuted,
    draftBgmVolume,
    draftSystemVolume,
    draftSfxVolume,
    onMasterVolumeChange,
    onMutedChange,
  ]);

  const handleCancel = useCallback(() => {
    // Reset draft to saved settings
    setDraftMasterVolume(soundSettings.masterVolume);
    setDraftMuted(soundSettings.muted);
    setDraftBgmVolume(soundSettings.categoryVolume.ambient);
    setDraftSystemVolume(soundSettings.categoryVolume.system);
    setDraftSfxVolume(soundSettings.categoryVolume.ui);
    onMasterVolumeChange(soundSettings.masterVolume);
    onMutedChange(soundSettings.muted);
  }, [soundSettings, onMasterVolumeChange, onMutedChange]);

  useEffect(() => {
    registerActions?.({ save: handleSave, cancel: handleCancel });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSave, handleCancel]);

  return (
    <Stack gap={6} color="white">
      {/* 全体音量 */}
      <Box>
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="bold" fontSize="sm">
            全体音量
          </Text>
          <Text fontSize="sm" opacity={0.8}>
            {Math.round(draftMasterVolume * 100)}%
          </Text>
        </HStack>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={draftMasterVolume}
          onChange={(e) => setDraftMasterVolume(parseFloat(e.target.value))}
          style={{
            width: "100%",
            accentColor: UI_TOKENS.COLORS.dragonQuestGold,
          }}
        />
      </Box>

      {/* ミュート */}
      <HStack justify="space-between">
        <Text fontWeight="bold" fontSize="sm">
          ミュート
        </Text>
        <Box
          as="button"
          onClick={() => setDraftMuted(!draftMuted)}
          px={4}
          py={1}
          bg={draftMuted ? UI_TOKENS.COLORS.dragonQuestGold : "gray.700"}
          color={draftMuted ? "black" : "white"}
          borderRadius={0}
          border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          fontWeight="bold"
          fontSize="sm"
          cursor="pointer"
          transition="all 0.2s"
          _hover={{ opacity: 0.8 }}
        >
          {draftMuted ? "ON" : "OFF"}
        </Box>
      </HStack>

      {/* BGM音量 */}
      <Box>
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="bold" fontSize="sm">
            BGM音量
          </Text>
          <Text fontSize="sm" opacity={0.8}>
            {Math.round(draftBgmVolume * 100)}%
          </Text>
        </HStack>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={draftBgmVolume}
          onChange={(e) => setDraftBgmVolume(parseFloat(e.target.value))}
          style={{
            width: "100%",
            accentColor: UI_TOKENS.COLORS.dragonQuestGold,
          }}
        />
      </Box>

      {/* 演出サウンド音量 */}
      <Box>
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="bold" fontSize="sm">
            演出サウンド音量
          </Text>
          <Text fontSize="sm" opacity={0.8}>
            {Math.round(draftSystemVolume * 100)}%
          </Text>
        </HStack>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={draftSystemVolume}
          onChange={(e) => setDraftSystemVolume(parseFloat(e.target.value))}
          style={{
            width: "100%",
            accentColor: UI_TOKENS.COLORS.dragonQuestGold,
          }}
        />
      </Box>

      {/* 効果音音量 */}
      <Box>
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="bold" fontSize="sm">
            効果音音量
          </Text>
          <Text fontSize="sm" opacity={0.8}>
            {Math.round(draftSfxVolume * 100)}%
          </Text>
        </HStack>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={draftSfxVolume}
          onChange={(e) => setDraftSfxVolume(parseFloat(e.target.value))}
          style={{
            width: "100%",
            accentColor: UI_TOKENS.COLORS.dragonQuestGold,
          }}
        />
      </Box>

    </Stack>
  );
}
