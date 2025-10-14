"use client";
import { Box, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { useSoundManager, useSoundSettings } from "@/lib/audio/SoundProvider";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

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
  const initialAmbient = snapshot.categoryVolume.ambient;
  const fallbackBgm = initialAmbient > 0.001 ? initialAmbient : 0.1;
  const [bgmVolume, setBgmVolume] = useState(fallbackBgm);
  const [bgmEnabled, setBgmEnabled] = useState(
    snapshot.categoryVolume.ambient > 0.001
  );
  const [lastBgmVolume, setLastBgmVolume] = useState(
    snapshot.categoryVolume.ambient > 0.001 ? snapshot.categoryVolume.ambient : 0.1
  );
  const [sfxVolume, setSfxVolume] = useState(snapshot.categoryVolume.ui);
  const [notifyVolume, setNotifyVolume] = useState(snapshot.categoryVolume.notify);
  const [fanfareVolume, setFanfareVolume] = useState(
    snapshot.categoryVolume.fanfare ?? 1
  );
  const [successMode, setSuccessMode] = useState(snapshot.successMode);
  const soundEnabled = !muted;

  const syncFromSettings = useCallback(() => {
    const current = soundManager?.getSettings() ?? soundSettings;
    setMasterVolume(current.masterVolume);
    setMuted(current.muted);
    const ambientVolume = current.categoryVolume.ambient;
    const hasAmbient = ambientVolume > 0.001;
    setBgmEnabled(hasAmbient);
    setLastBgmVolume((prev) => (hasAmbient ? ambientVolume : prev || 0.1));
    setBgmVolume((prev) => (hasAmbient ? ambientVolume : prev || 0.1));
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
      if (value > 0.001) {
        setBgmEnabled(true);
        setLastBgmVolume(value);
        setBgmVolume(value);
      } else {
        setBgmEnabled(false);
        setBgmVolume((prev) => (prev > 0.001 ? prev : lastBgmVolume || 0.1));
      }
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

  const toggleBgm = () => {
    if (!soundManager) return;
    if (bgmEnabled) {
      const stored = bgmVolume > 0.001 ? bgmVolume : lastBgmVolume || 0.1;
      setLastBgmVolume(stored);
      setBgmEnabled(false);
      setBgmVolume(stored);
      soundManager.setCategoryVolume("ambient", 0);
      return;
    }

    const restore = lastBgmVolume > 0.001 ? lastBgmVolume : 0.1;
    setBgmEnabled(true);
    setLastBgmVolume(restore);
    setBgmVolume(restore);
    soundManager.setCategoryVolume("ambient", restore);
  };

  const renderSlider = (
    label: string,
    value: number,
    onChange: (val: number) => void,
    options?: {
      accessory?: ReactNode;
      disabled?: boolean;
    }
  ) => {
    const sliderDisabled = options?.disabled ?? false;
    return (
      <Box>
        <HStack justify="space-between" mb="6px">
          <Text
            fontWeight="bold"
            fontSize="13px"
            fontFamily="monospace"
            textShadow="1px 1px 0px #000"
            letterSpacing="0.01em"
            opacity={sliderDisabled ? 0.6 : 1}
          >
            {label}
          </Text>
          <HStack gap="8px">
            {options?.accessory}
            <Box
              px="7px"
              py="1px"
              bg={UI_TOKENS.COLORS.panelBg}
              border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha60}`}
              borderRadius={0}
              boxShadow="inset 0 1px 2px rgba(0,0,0,0.4)"
              opacity={sliderDisabled ? 0.6 : 1}
            >
              <Text
                fontSize="11px"
                fontFamily="monospace"
                fontWeight="bold"
                textShadow="1px 1px 0px #000"
              >
                {Math.round(value * 100)}%
              </Text>
            </Box>
          </HStack>
        </HStack>

        {/* ドラゴンクエスト風カスタムスライダー */}
        <Box position="relative" py="4px" opacity={sliderDisabled ? 0.55 : 1}>
          {/* スライダーのレール（背景） */}
          <Box
            position="relative"
            h="11px"
            bg={UI_TOKENS.COLORS.panelBg}
            border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
            borderRadius={0}
            boxShadow="inset 0.5px 1px 3px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.1), inset -0.5px 0 2px rgba(0,0,0,0.2)"
          >
            {/* 塗りつぶしバー（ゴールド + ノイズテクスチャ） */}
            <Box
              position="absolute"
              top="0"
              left="0"
              h="100%"
              w={`${value * 100}%`}
              bg={UI_TOKENS.COLORS.dqGold}
              boxShadow="inset 0 -1px 0 rgba(0,0,0,0.35), inset 0.5px 1px 0 rgba(255,255,255,0.4), inset -1px 0 1px rgba(0,0,0,0.15)"
              transition="width 0.08s cubic-bezier(.2,1,.3,1)"
              css={{
                backgroundImage: `linear-gradient(
                135deg,
                rgba(255,255,255,0.08) 0%,
                transparent 25%,
                rgba(0,0,0,0.05) 50%,
                transparent 75%,
                rgba(255,255,255,0.06) 100%
              )`,
                backgroundSize: "8px 8px",
              }}
            />
          </Box>

          {/* HTMLスライダー（見た目は透明） */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={value}
            onChange={(event) => onChange(parseFloat(event.target.value))}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: sliderDisabled ? "not-allowed" : "pointer",
              margin: 0,
              padding: 0,
            }}
            disabled={sliderDisabled}
          />
        </Box>
      </Box>
    );
  };



  return (
    <Stack gap="11px" color="white" fontFamily="monospace">
      {renderSlider("全体音量", masterVolume, (value) => applyMasterVolume(value))}

      {renderSlider(
        "BGM",
        bgmVolume,
        (value) => {
          applyCategoryVolume("ambient", value);
        },
        {
          accessory: (
            <Box
              as="button"
              onClick={toggleBgm}
              px="12px"
              py="3px"
              minW="56px"
              bg={bgmEnabled ? UI_TOKENS.COLORS.dqGold : UI_TOKENS.COLORS.panelBg}
              color={bgmEnabled ? "black" : "white"}
              borderRadius={0}
              border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
              fontWeight="bold"
              fontSize="11px"
              cursor="pointer"
              boxShadow={
                bgmEnabled
                  ? "2.5px 2px 0 rgba(0,0,0,0.4), inset 0.5px 1px 0 rgba(255,255,255,0.35), inset -0.5px -1px 1px rgba(0,0,0,0.15)"
                  : "2.5px 2px 0 rgba(0,0,0,0.4), inset 0.5px 1px 3px rgba(0,0,0,0.3)"
              }
              transition="all 0.18s cubic-bezier(.2,1,.3,1)"
              transform={bgmEnabled ? "translate(0.5px, -0.5px)" : "translate(0, 0)"}
              textShadow={bgmEnabled ? "none" : "1px 1px 0px #000"}
              css={
                bgmEnabled
                  ? {
                      backgroundImage: `linear-gradient(
                        135deg,
                        rgba(255,255,255,0.08) 0%,
                        transparent 25%,
                        rgba(0,0,0,0.05) 50%,
                        transparent 75%,
                        rgba(255,255,255,0.06) 100%
                      )`,
                      backgroundSize: "8px 8px",
                    }
                  : {}
              }
              _hover={{
                transform: "translate(0, -1px)",
                boxShadow: bgmEnabled
                  ? "3px 3px 0 rgba(0,0,0,0.4), inset 0.5px 1px 0 rgba(255,255,255,0.35), inset -0.5px -1px 1px rgba(0,0,0,0.15)"
                  : "3px 3px 0 rgba(0,0,0,0.4), inset 0.5px 1px 3px rgba(0,0,0,0.3)",
              }}
              _active={{
                transform: "translate(0, 0)",
                boxShadow: "1.5px 1px 0 rgba(0,0,0,0.5), inset 0.5px 1px 3px rgba(0,0,0,0.4)",
              }}
            >
              {bgmEnabled ? "ON" : "OFF"}
            </Box>
          ),
          disabled: !bgmEnabled,
        }
      )}

      {renderSlider("効果音", sfxVolume, (value) => {
        setSfxVolume(value);
        applyCategoryVolume("ui", value);
      })}

      {renderSlider("通知音", notifyVolume, (value) => {
        setNotifyVolume(value);
        applyCategoryVolume("notify", value);
      })}

      {renderSlider("ファンファーレ", fanfareVolume, (value) => {
        setFanfareVolume(value);
        applyCategoryVolume("fanfare", value);
      })}

      <Box mt="7px">
        <HStack justify="space-between" align="center" mb="7px">
          <Text
            fontWeight="bold"
            fontSize="13px"
            textShadow="1px 1px 0px #000"
            letterSpacing="0.01em"
          >
            勝利ファンファーレ
          </Text>
        </HStack>
        <HStack gap="9px" flexWrap="wrap">
          {[
            { mode: "normal" as const, title: "ノーマル" },
            { mode: "epic" as const, title: "エピック" },
          ].map(({ mode, title }) => {
            const active = successMode === mode;
            return (
              <Box
                key={mode}
                as="button"
                onClick={() => applySuccessMode(mode)}
                px="14px"
                py="7px"
                borderRadius={0}
                border="2px solid"
                borderColor={
                  active
                    ? UI_TOKENS.COLORS.whiteAlpha90
                    : UI_TOKENS.COLORS.whiteAlpha40
                }
                bg={
                  active ? UI_TOKENS.COLORS.dqGold : UI_TOKENS.COLORS.whiteAlpha10
                }
                color={active ? "black" : "white"}
                flex="1"
                textAlign="center"
                cursor="pointer"
                fontWeight="bold"
                fontSize="13px"
                boxShadow={
                  active
                    ? "2.5px 2px 0 rgba(0,0,0,0.4), inset 0.5px 1px 0 rgba(255,255,255,0.35), inset -0.5px -1px 1px rgba(0,0,0,0.15)"
                    : "2.5px 2px 0 rgba(0,0,0,0.3), inset 0.5px 1px 3px rgba(0,0,0,0.3)"
                }
                transform={active ? "translate(0.5px, -0.5px)" : "translate(0, 0)"}
                transition="all 0.18s cubic-bezier(.2,1,.3,1)"
                textShadow={active ? "none" : "1px 1px 0px #000"}
                css={
                  active
                    ? {
                        backgroundImage: `linear-gradient(
                          135deg,
                          rgba(255,255,255,0.08) 0%,
                          transparent 25%,
                          rgba(0,0,0,0.05) 50%,
                          transparent 75%,
                          rgba(255,255,255,0.06) 100%
                        )`,
                        backgroundSize: "8px 8px",
                      }
                    : {}
                }
                _hover={{
                  transform: "translate(0, -1px)",
                  boxShadow: active
                    ? "3px 3px 0 rgba(0,0,0,0.4), inset 0.5px 1px 0 rgba(255,255,255,0.35), inset -0.5px -1px 1px rgba(0,0,0,0.15)"
                    : "3px 3px 0 rgba(0,0,0,0.3), inset 0.5px 1px 3px rgba(0,0,0,0.3)",
                }}
                _active={{
                  transform: "translate(0, 0)",
                  boxShadow: "1.5px 1px 0 rgba(0,0,0,0.5), inset 0.5px 1px 3px rgba(0,0,0,0.4)",
                }}
              >
                {title}
              </Box>
            );
          })}
        </HStack>
      </Box>

      <HStack justify="space-between" align="center" mt="7px">
        <Text
          fontWeight="bold"
          fontSize="13px"
          textShadow="1px 1px 0px #000"
          letterSpacing="0.01em"
        >
          サウンド
        </Text>
        <Box
          as="button"
          onClick={() => applyMuted(!muted)}
          px="14px"
          py="5px"
          minW="60px"
          bg={soundEnabled ? UI_TOKENS.COLORS.dqGold : UI_TOKENS.COLORS.panelBg}
          color={soundEnabled ? "black" : "white"}
          borderRadius={0}
          border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          fontWeight="bold"
          fontSize="13px"
          cursor="pointer"
          boxShadow={
            soundEnabled ? "2.5px 2px 0 rgba(0,0,0,0.4), inset 0.5px 1px 0 rgba(255,255,255,0.35), inset -0.5px -1px 1px rgba(0,0,0,0.15)"
              : "2.5px 2px 0 rgba(0,0,0,0.4), inset 0.5px 1px 3px rgba(0,0,0,0.3)"
          }
          transition="all 0.18s cubic-bezier(.2,1,.3,1)"
          transform={soundEnabled ? "translate(0.5px, -0.5px)" : "translate(0, 0)"}
          textShadow={soundEnabled ? "none" : "1px 1px 0px #000"}
          css={
            soundEnabled ? {
                  backgroundImage: `linear-gradient(
                    135deg,
                    rgba(255,255,255,0.08) 0%,
                    transparent 25%,
                    rgba(0,0,0,0.05) 50%,
                    transparent 75%,
                    rgba(255,255,255,0.06) 100%
                  )`,
                  backgroundSize: "8px 8px",
                }
              : {}
          }
          _hover={{
            transform: muted ? "translate(0, -1px)" : "translate(0, -1px)",
            boxShadow: soundEnabled
              ? "3px 3px 0 rgba(0,0,0,0.4), inset 0.5px 1px 0 rgba(255,255,255,0.35), inset -0.5px -1px 1px rgba(0,0,0,0.15)"
              : "3px 3px 0 rgba(0,0,0,0.4), inset 0.5px 1px 3px rgba(0,0,0,0.3)",
          }}
          _active={{
            transform: "translate(0, 0)",
            boxShadow: "1.5px 1px 0 rgba(0,0,0,0.5), inset 0.5px 1px 3px rgba(0,0,0,0.4)",
          }}
        >
          {soundEnabled ? "ON" : "OFF"}
        </Box>
      </HStack>
    </Stack>
  );
}



