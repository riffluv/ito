"use client";
import SoundSettingsPlaceholder from "@/components/settings/SoundSettingsPlaceholder";
import { SoundSettingsPanel } from "@/components/settings/SoundSettingsPanel";
import { notify } from "@/components/ui/notify";
import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { useSoundManager, useSoundSettings } from "@/lib/audio/SoundProvider";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { db } from "@/lib/firebase/client";
import type { RoomDoc } from "@/lib/types";
import { UI_TOKENS } from "@/theme/layout";
import { Box, Dialog, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { doc, updateDoc } from "firebase/firestore";
import { useEffect, useState as useLocalState, useState, useRef, useCallback } from "react";
import { usePixiHudLayer } from "@/components/ui/pixi/PixiHudStage";
import { usePixiLayerLayout } from "@/components/ui/pixi/usePixiLayerLayout";
import PIXI from "@/lib/pixi/instance";
import { drawSettingsModalBackground } from "@/lib/pixi/settingsModalBackground";
import { MODAL_FRAME_STYLES } from "@/components/ui/modalFrameStyles";

type BackgroundOption = "css" | "pixi-simple" | "pixi-dq" | "pixi-inferno";
type SceneryVariant = "night" | "inferno";
type SettingsTab = "game" | "graphics" | "sound";
type GraphicsTab = "background" | "animation";
type AnimationModeOption = "3d" | "simple";

const SETTINGS_TABS: ReadonlyArray<{ key: SettingsTab; label: string }> = [
  { key: "game", label: "Game Settings" },
  { key: "graphics", label: "Graphics Settings" },
  { key: "sound", label: "Sound Settings" },
];

const GRAPHICS_TABS: ReadonlyArray<{ key: GraphicsTab; label: string }> = [
  { key: "background", label: "背景" },
  { key: "animation", label: "アニメ" },
];

const CARD_ANIMATION_OPTIONS: ReadonlyArray<{
  value: AnimationModeOption;
  title: string;
  description: string;
}> = [
  {
    value: "3d",
    title: "3D回転",
    description: "カードが立体的に回転します（おすすめ）",
  },
  {
    value: "simple",
    title: "シンプル",
    description: "回転を省いて軽量表示にします",
  },
];

const normalizeBackgroundOption = (
  value: string | null
): BackgroundOption => {
  if (value === "pixi-simple" || value === "pixi-lite") {
    return "pixi-simple";
  }
  if (value === "pixi-dq" || value === "pixi" || value === "pixijs") {
    return "pixi-dq";
  }
  if (value === "pixi-inferno" || value === "inferno") {
    return "pixi-inferno";
  }
  return "css";
};

// 背景タイプからバリエーションへのマッピング
const getVariantFromBackground = (bg: BackgroundOption): SceneryVariant | null => {
  if (bg === "pixi-dq") return "night";
  if (bg === "pixi-inferno") return "inferno";
  return null;
};

// バリエーションから背景タイプへのマッピング
const getBackgroundFromVariant = (variant: SceneryVariant): BackgroundOption => {
  if (variant === "night") return "pixi-dq";
  if (variant === "inferno") return "pixi-inferno";
  return "pixi-dq";
};


export type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentOptions: RoomDoc["options"];
  isHost: boolean;
  roomStatus: string;
};

export function SettingsModal({
  isOpen,
  onClose,
  roomId,
  currentOptions,
  isHost,
  roomStatus,
}: SettingsModalProps) {
  const {
    animationMode,
    setAnimationMode,
    effectiveMode,
    gpuCapability,
    supports3D,
    force3DTransforms,
    setForce3DTransforms,
  } = useAnimationSettings();

  // Pixi HUD レイヤー（モーダル背景用）
  const modalRef = useRef<HTMLDivElement | null>(null);
  const pixiContainer = usePixiHudLayer("settings-modal", {
    zIndex: 105,
  });
  const pixiGraphicsRef = useRef<PIXI.Graphics | null>(null);

  const [resolveMode, setResolveMode] = useState<string>(
    currentOptions?.resolveMode || "sort-submit"
  );
  const [defaultTopicType, setDefaultTopicType] = useState<string>(
    currentOptions?.defaultTopicType || "通常版"
  );
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("game");

  // 背景設定のstate（localStorageから読み込み）
  const [backgroundType, setBackgroundType] =
    useLocalState<BackgroundOption>("pixi-dq");
  const [graphicsTab, setGraphicsTab] = useState<GraphicsTab>("background");
  const soundManager = useSoundManager();
  const soundSettings = useSoundSettings();
  const playSettingsOpen = useSoundEffect("settings_open");
  const playSettingsClose = useSoundEffect("settings_close");
  const closeOnceRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      closeOnceRef.current = false;
      playSettingsOpen();
    } else {
      closeOnceRef.current = false;
    }
  }, [isOpen, playSettingsOpen]);

  const closeWithSound = useCallback(() => {
    if (closeOnceRef.current) return;
    closeOnceRef.current = true;
    playSettingsClose();
    onClose();
  }, [onClose, playSettingsClose]);

  const SOUND_FEATURE_LOCKED = false;
  const soundLockMessage =
    "サウンド素材を制作中です。準備ができ次第ここで設定できます。";

  const backgroundLabelMap: Record<BackgroundOption, string> = {
    css: "CSS はいけい",
    "pixi-simple": "Pixi ライト",
    "pixi-dq": "山はいいよね（夜）",
    "pixi-inferno": "山はいいよね（煉獄）",
  };

  const backgroundOptions: {
    value: BackgroundOption | "scenery"; // "scenery" は山はいいよねグループ
    title: string;
    description: string;
    hasVariants?: boolean;
  }[] = [
    {
      value: "css",
      title: "CSS はいけい",
      description: "けいりょうな CSS グラデーション。すべての環境で安定。",
    },
    {
      value: "pixi-simple",
      title: "Pixi はいけい",
      description: "黒ベースの PixiJS 背景。",
    },
    {
      value: "scenery",
      title: "山はいいよね。 pixiJS",
      description: "和みそうな、景色 PixiJS 背景。",
      hasVariants: true,
    },
  ];

  const sceneryVariants: {
    value: SceneryVariant;
    label: string;
    description: string;
  }[] = [
    {
      value: "night",
      label: "夜",
      description: "星空と山々の夜景",
    },
    {
      value: "inferno",
      label: "煉獄",
      description: "地獄の炎と溶岩",
    },
  ];

  const [forceAnimations, setForceAnimations] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = window.localStorage.getItem("force-animations");
      if (stored === null) {
        window.localStorage.setItem("force-animations", "true");
        return true;
      }
      return stored === "true";
    } catch {
      return true;
    }
  });
  const [osReduced, setOsReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch {
      return false;
    }
  });

  // OSのreduce-motion変化を監視
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = () => setOsReduced(mq.matches);
    let cleanup: (() => void) | undefined;
    try {
      mq.addEventListener("change", listener);
      cleanup = () => mq.removeEventListener("change", listener);
    } catch {
      const legacyMq = mq as MediaQueryList & {
        addListener?: (cb: (event: MediaQueryListEvent) => void) => void;
        removeListener?: (cb: (event: MediaQueryListEvent) => void) => void;
      };
      legacyMq.addListener?.(listener);
      cleanup = () => legacyMq.removeListener?.(listener);
    }
    listener();
    return () => {
      cleanup?.();
    };
  }, []);

  // localStorageから背景設定を読み込み
  useEffect(() => {
    try {
      const saved = localStorage.getItem("backgroundType");
      if (saved) {
        setBackgroundType(normalizeBackgroundOption(saved));
      } else {
        localStorage.setItem("backgroundType", "pixi-dq");
        setBackgroundType("pixi-dq");
      }
    } catch {
      // noop
    }
  }, [setBackgroundType]);

  // 背景設定のリアルタイム更新
  const handleBackgroundChange = (newType: BackgroundOption) => {
    setBackgroundType(newType);
    try {
      localStorage.setItem("backgroundType", newType);
      window.dispatchEvent(
        new CustomEvent("backgroundTypeChanged", {
          detail: { backgroundType: newType },
        })
      );
    } catch {
      // noop
    }
  };

  // バリエーション変更ハンドラ
  const handleVariantChange = (variant: SceneryVariant) => {
    const newBg = getBackgroundFromVariant(variant);
    handleBackgroundChange(newBg);
  };

  // アニメーション優先トグル（reduced-motion無視）
  const setForceAnimationsPersist = (next: boolean) => {
    setForceAnimations(next);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "force-animations",
          next ? "true" : "false"
        );
        window.dispatchEvent(new CustomEvent("forceAnimationsChanged"));
      }
    } catch {}
    notify({
      title: next ? "アニメーション優先（強制ON）" : "OS設定を尊重",
      description: next
        ? "reduce-motion を無視して軽量アニメを有効にします"
        : osReduced
          ? "OSが動きを減らす=ONのため、アニメは控えめになります"
          : "OSが動きを減らす=OFFのため、アニメは通常動作します",
      type: "info",
      duration: 1800,
    });
  };

  const handleSave = async () => {
    if (!isHost) {
      notify({ title: "ホストのみ設定を変更できます", type: "warning" });
      return;
    }

    if (roomStatus !== "waiting") {
      notify({
        title: "待機中のみ設定を変更できます",
        type: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db!, "rooms", roomId), {
        "options.resolveMode": resolveMode,
        "options.defaultTopicType": defaultTopicType,
      });
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("defaultTopicType", defaultTopicType);
          window.localStorage.setItem("backgroundType", backgroundType);
          // 🧩 他UIへ即時反映用のカスタムイベント
          window.dispatchEvent(
            new CustomEvent("defaultTopicTypeChanged", {
              detail: { defaultTopicType },
            })
          );
        }
      } catch {}
      notify({ title: "設定を保存しました", type: "success" });
      closeWithSound();
    } catch (error: unknown) {
      const description =
        error instanceof Error ? error.message : String(error);
      notify({
        title: "設定の保存に失敗しました",
        description,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const modeOptions = [
    {
      value: "sort-submit",
      title: "みんなで ならべる",
      description: "ぜんいん カードを ならべてから はんてい",
    },
  ];

  const topicTypeOptions = [
    {
      value: "通常版",
      title: "通常版",
      description: "バランスの取れた定番のお題",
    },
    {
      value: "レインボー版",
      title: "レインボー版",
      description: "カラフルで創造的なお題",
    },
    {
      value: "クラシック版",
      title: "クラシック版",
      description: "シンプルで分かりやすいお題",
    },
    {
      value: "カスタム",
      title: "カスタム",
      description: "じぶんたちで お題を入力して あそぶ",
    },
  ];

  // Pixi背景の描画とDOM同期
  useEffect(() => {
    const destroyGraphics = () => {
      if (pixiGraphicsRef.current) {
        pixiGraphicsRef.current.destroy({ children: true });
        pixiGraphicsRef.current = null;
      }
    };

    if (!isOpen || !pixiContainer) {
      destroyGraphics();
      return destroyGraphics;
    }

    const graphics = new PIXI.Graphics();
    graphics.zIndex = -10; // 最背面に配置
    pixiContainer.addChild(graphics);
    pixiGraphicsRef.current = graphics;

    return destroyGraphics;
  }, [isOpen, pixiContainer]);

  // DOM要素とPixiコンテナの位置・サイズ同期
  usePixiLayerLayout(modalRef, pixiContainer, {
    disabled: !isOpen || !pixiContainer,
    onUpdate: (layout) => {
      const graphics = pixiGraphicsRef.current;
      if (!graphics || layout.width <= 0 || layout.height <= 0) {
        return;
      }

      graphics.clear();
      graphics.position.set(layout.x, layout.y);
      drawSettingsModalBackground(PIXI, graphics, {
        width: layout.width,
        height: layout.height,
        dpr: layout.dpr,
      });
    },
  });

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => {
        if (!details.open) {
          closeWithSound();
        }
      }}
    >
      <Dialog.Backdrop
        css={{
          background: "overlayStrong",
          backdropFilter: "blur(12px) saturate(1.2)",
        }}
      />
      <Dialog.Positioner>
        <Dialog.Content
          ref={modalRef}
          data-pixi-target="settings-modal"
          css={{
            ...MODAL_FRAME_STYLES,
          }}
        >
          {/* Close button - 統一パターン */}
          <Dialog.CloseTrigger
            css={{
              position: "absolute",
              top: "12px",
              right: "12px",
              zIndex: 30,
              background: UI_TOKENS.COLORS.panelBg,
              borderRadius: "0",
              padding: "0",
              border: `2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
              color: "white",
              cursor: "pointer",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              fontWeight: "bold",
              transition: `background-color 177ms cubic-bezier(.2,1,.3,1), color 177ms cubic-bezier(.2,1,.3,1), border-color 177ms cubic-bezier(.2,1,.3,1)`,
              "&:hover": {
                background: "white",
                color: UI_TOKENS.COLORS.panelBg,
              },
            }}
          >
            ✕
          </Dialog.CloseTrigger>

          {/* Header - 統一パターン */}
          <Box
            p={6}
            position="relative"
            zIndex={20}
            css={{
              borderBottom: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            }}
          >
            <Dialog.Title
              css={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: "white",
                margin: 0,
                fontFamily: "monospace",
                textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                textAlign: "center",
              }}
            >
              せっていを かえる
            </Dialog.Title>
            <Text
              fontSize="sm"
              color={UI_TOKENS.COLORS.textMuted}
              mt={1}
              css={{
                textAlign: "center",
              }}
            >
              あそびかたを きめてください
            </Text>
          </Box>

          <Dialog.Body px={6} pb={4} position="relative" zIndex={20}>
            <HStack gap={3} justify="center" mt={3} mb={3}>
              {SETTINGS_TABS.map((t) => {
                const isActive = activeTab === t.key;
                return (
                  <Box
                    key={t.key}
                    as="button"
                    onClick={() => setActiveTab(t.key)}
                    px={4}
                    py={2}
                    borderRadius="0"
                    border="2px solid"
                    borderColor={
                      isActive
                        ? UI_TOKENS.COLORS.whiteAlpha90
                        : UI_TOKENS.COLORS.whiteAlpha30
                    }
                    bg={
                      isActive
                        ? UI_TOKENS.COLORS.whiteAlpha10
                        : UI_TOKENS.COLORS.panelBg
                    }
                    color="white"
                    fontFamily="monospace"
                    fontWeight="bold"
                    transition={`background-color 117ms cubic-bezier(.2,1,.3,1), color 117ms cubic-bezier(.2,1,.3,1), border-color 117ms cubic-bezier(.2,1,.3,1)`}
                  >
                    {t.label}
                  </Box>
                );
              })}
            </HStack>

            {activeTab === "game" && (
              <Stack gap={6}>
                {/* クリア方式セクション */}
                <Box>
                  <Text fontSize="sm" fontWeight="600" color="gray.300" mb={3}>
                    どうやって あそぶか
                  </Text>
                  <Stack gap={2}>
                    {modeOptions.map((option) => {
                      const isSelected = resolveMode === option.value;
                      return (
                        <Box
                          key={option.value}
                          cursor="pointer"
                          onClick={() => setResolveMode(option.value)}
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
                                isSelected
                                  ? "white"
                                  : UI_TOKENS.COLORS.whiteAlpha50
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

                {/* お題タイプセクション */}
                <Box>
                  <Text fontSize="sm" fontWeight="600" color="gray.300" mb={3}>
                    おだいの しゅるい
                  </Text>
                  <Stack gap={2}>
                    {topicTypeOptions.map((option) => {
                      const isSelected = defaultTopicType === option.value;
                      return (
                        <Box
                          key={option.value}
                          cursor="pointer"
                          onClick={() => setDefaultTopicType(option.value)}
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
                                isSelected
                                  ? "white"
                                  : UI_TOKENS.COLORS.whiteAlpha50
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
              </Stack>
            )}

            {activeTab === "graphics" && (
              <Stack gap={6} mt={4}>
                {/* グラフィック設定の説明は冗長なので削除 */}
                {/* サブタブ（背景/アニメ） */}
                <HStack gap={3} justify="center">
                  {GRAPHICS_TABS.map((t) => {
                    const isActive = graphicsTab === t.key;
                    return (
                      <Box
                        key={t.key}
                        as="button"
                        onClick={() => setGraphicsTab(t.key)}
                        px={4}
                        py={2}
                        borderRadius="0"
                        border="2px solid"
                        borderColor={
                          isActive
                            ? UI_TOKENS.COLORS.whiteAlpha90
                            : UI_TOKENS.COLORS.whiteAlpha30
                        }
                        bg={
                          isActive
                            ? UI_TOKENS.COLORS.whiteAlpha10
                            : UI_TOKENS.COLORS.panelBg
                        }
                        color="white"
                        fontFamily="monospace"
                        fontWeight="bold"
                        transition={`background-color 117ms cubic-bezier(.2,1,.3,1), color 117ms cubic-bezier(.2,1,.3,1), border-color 117ms cubic-bezier(.2,1,.3,1)`}
                      >
                        {t.label}
                      </Box>
                    );
                  })}
                </HStack>

                {/* 背景設定セクション */}
                <Box hidden={graphicsTab !== "background"}>
                  <Text fontSize="sm" fontWeight="600" color="gray.300" mb={1}>
                    はいけい モード
                  </Text>
                  <Text fontSize="xs" color={UI_TOKENS.COLORS.textMuted} mb={3}>
                    げんざい: {backgroundLabelMap[backgroundType]}
                  </Text>
                  <Stack gap={2}>
                    {backgroundOptions.map((opt) => {
                      // sceneryグループの場合は特別処理
                      if (opt.value === "scenery") {
                        const currentVariant = getVariantFromBackground(backgroundType);
                        const isScenerySelected = currentVariant !== null;

                        return (
                          <Box
                            key={opt.value}
                            p={4}
                            borderRadius="0"
                            border="2px solid"
                            borderColor={
                              isScenerySelected
                                ? UI_TOKENS.COLORS.whiteAlpha90
                                : UI_TOKENS.COLORS.whiteAlpha30
                            }
                            bg={
                              isScenerySelected
                                ? UI_TOKENS.COLORS.whiteAlpha10
                                : UI_TOKENS.COLORS.panelBg
                            }
                            transition={`background-color 177ms cubic-bezier(.2,1,.3,1), border-color 177ms cubic-bezier(.2,1,.3,1), box-shadow 177ms cubic-bezier(.2,1,.3,1)`}
                            boxShadow={
                              isScenerySelected
                                ? UI_TOKENS.SHADOWS.panelDistinct
                                : UI_TOKENS.SHADOWS.panelSubtle
                            }
                          >
                            <HStack
                              justify="space-between"
                              align="start"
                              cursor="pointer"
                              onClick={() => {
                                if (!isScenerySelected) {
                                  handleVariantChange("night");
                                }
                              }}
                            >
                              <VStack align="start" gap={1} flex="1">
                                <Text
                                  fontSize="md"
                                  fontWeight="bold"
                                  color="white"
                                  fontFamily="monospace"
                                  textShadow="1px 1px 0px #000"
                                >
                                  {opt.title}
                                </Text>
                                <Text
                                  fontSize="sm"
                                  color={UI_TOKENS.COLORS.textMuted}
                                  lineHeight="short"
                                  fontFamily="monospace"
                                >
                                  {opt.description}
                                </Text>
                              </VStack>
                              <Box
                                w={5}
                                h={5}
                                borderRadius="0"
                                border="2px solid"
                                borderColor={
                                  isScenerySelected
                                    ? "white"
                                    : UI_TOKENS.COLORS.whiteAlpha50
                                }
                                bg={isScenerySelected ? "white" : "transparent"}
                                mt={0.5}
                                position="relative"
                                transition="background-color 177ms cubic-bezier(.2,1,.3,1), border-color 177ms cubic-bezier(.2,1,.3,1)"
                              >
                                {isScenerySelected && (
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

                            {/* バリエーション選択（選択時のみ表示） */}
                            {isScenerySelected && (
                              <Box mt={3} pt={3} borderTop="1px solid" borderColor={UI_TOKENS.COLORS.whiteAlpha20}>
                                <Text
                                  fontSize="xs"
                                  fontWeight="600"
                                  color={UI_TOKENS.COLORS.textMuted}
                                  mb={2}
                                  fontFamily="monospace"
                                >
                                  バリエーション:
                                </Text>
                                <HStack gap={2}>
                                  {sceneryVariants.map((variant) => {
                                    const isVariantSelected = currentVariant === variant.value;

                                    return (
                                      <Box
                                        key={variant.value}
                                        as="button"
                                        flex="1"
                                        px={3}
                                        py={2}
                                        borderRadius="0"
                                        border="2px solid"
                                        borderColor={
                                          isVariantSelected
                                            ? UI_TOKENS.COLORS.whiteAlpha90
                                            : UI_TOKENS.COLORS.whiteAlpha30
                                        }
                                        bg={
                                          isVariantSelected
                                            ? UI_TOKENS.COLORS.whiteAlpha15
                                            : UI_TOKENS.COLORS.panelBg
                                        }
                                        color="white"
                                        fontFamily="monospace"
                                        fontSize="sm"
                                        fontWeight="bold"
                                        cursor="pointer"
                                        transition={`background-color 117ms cubic-bezier(.2,1,.3,1), border-color 117ms cubic-bezier(.2,1,.3,1)`}
                                        onClick={() => handleVariantChange(variant.value)}
                                        _hover={{
                                          borderColor: UI_TOKENS.COLORS.whiteAlpha80,
                                          bg: isVariantSelected
                                            ? UI_TOKENS.COLORS.whiteAlpha20
                                            : UI_TOKENS.COLORS.whiteAlpha05,
                                        }}
                                        title={variant.description}
                                      >
                                        {variant.label}
                                      </Box>
                                    );
                                  })}
                                </HStack>
                              </Box>
                            )}
                          </Box>
                        );
                      }

                      // 通常の背景オプション
                      const isSelected = backgroundType === opt.value;
                      return (
                        <Box
                          key={opt.value}
                          cursor="pointer"
                          onClick={() => handleBackgroundChange(opt.value as BackgroundOption)}
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
                                {opt.title}
                              </Text>
                              <Text
                                fontSize="sm"
                                color={UI_TOKENS.COLORS.textMuted}
                                lineHeight="short"
                                fontFamily="monospace"
                              >
                                {opt.description}
                              </Text>
                            </VStack>
                            <Box
                              w={5}
                              h={5}
                              borderRadius="0"
                              border="2px solid"
                              borderColor={
                                isSelected
                                  ? "white"
                                  : UI_TOKENS.COLORS.whiteAlpha50
                              }
                              bg={isSelected ? "white" : "transparent"}
                              mt={0.5}
                              position="relative"
                              transition="background-color 177ms cubic-bezier(.2,1,.3,1), border-color 177ms cubic-bezier(.2,1,.3,1)"
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

                <Box hidden={graphicsTab !== "animation"}>
                  <Text fontSize="sm" fontWeight="600" color="gray.300" mb={1}>
                    アニメーション モード
                  </Text>
                  <Text fontSize="xs" color={UI_TOKENS.COLORS.textMuted} mb={1}>
                    現在:{" "}
                    {force3DTransforms ? "3D回転" : "シンプル"}
                    （推定GPU: {gpuCapability === "high" ? "高" : "低"}）
                  </Text>
                  {effectiveMode === "simple" &&
                    animationMode !== "simple" &&
                    supports3D === false && (
                      <Text
                        fontSize="xs"
                        color={UI_TOKENS.COLORS.whiteAlpha60}
                        mb={3}
                      >
                        注: この端末では3Dが使えないため、シンプルで動作中
                      </Text>
                    )}
                  <Stack gap={2}>
                    {CARD_ANIMATION_OPTIONS.map((opt) => {
                      const isAvailable = !(opt.value === "3d" && supports3D === false);
                      const isSelected =
                        opt.value === "3d"
                          ? force3DTransforms
                          : !force3DTransforms && animationMode === "simple";
                      const handleClick = () => {
                        setAnimationMode(opt.value);
                        setForce3DTransforms(opt.value === "3d");
                      };
                      return (
                        <Box
                          key={opt.value}
                          cursor={isAvailable ? "pointer" : "not-allowed"}
                          onClick={isAvailable ? handleClick : undefined}
                          opacity={isAvailable ? 1 : 0.5}
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
                          _hover={
                            isAvailable
                              ? {
                                  borderColor: UI_TOKENS.COLORS.whiteAlpha80,
                                  bg: isSelected
                                    ? UI_TOKENS.COLORS.whiteAlpha15
                                    : UI_TOKENS.COLORS.panelBg,
                                }
                              : {}
                          }
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
                                {opt.title}
                              </Text>
                              <Text
                                fontSize="sm"
                                color={UI_TOKENS.COLORS.textMuted}
                                lineHeight="short"
                                fontFamily="monospace"
                              >
                                {opt.description}
                              </Text>
                            </VStack>
                            <Box
                              w={5}
                              h={5}
                              borderRadius="0"
                              border="2px solid"
                              borderColor={
                                isSelected
                                  ? "white"
                                  : UI_TOKENS.COLORS.whiteAlpha50
                              }
                              bg={isSelected ? "white" : "transparent"}
                              mt={0.5}
                              position="relative"
                              transition="background-color 177ms cubic-bezier(.2,1,.3,1), border-color 177ms cubic-bezier(.2,1,.3,1)"
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

                {/* アニメーションの動作モード（明示ラジオ） */}
                <Box hidden={graphicsTab !== "animation"}>
                  <Text fontSize="sm" fontWeight="600" color="gray.300" mb={1}>
                    アニメの基準（どちらを優先するか）
                  </Text>
                  <Text fontSize="xs" color={UI_TOKENS.COLORS.textMuted} mb={2}>
                    端末の設定: 動きを減らす = {osReduced ? "ON" : "OFF"}
                  </Text>
                  <Stack gap={2}>
                    {/* OS尊重 */}
                    <Box
                      cursor="pointer"
                      onClick={() => setForceAnimationsPersist(false)}
                      p={4}
                      borderRadius="0"
                      border="2px solid"
                      borderColor={
                        !forceAnimations
                          ? UI_TOKENS.COLORS.whiteAlpha90
                          : UI_TOKENS.COLORS.whiteAlpha30
                      }
                      bg={
                        !forceAnimations
                          ? UI_TOKENS.COLORS.whiteAlpha10
                          : UI_TOKENS.COLORS.panelBg
                      }
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
                          borderColor={
                            !forceAnimations
                              ? "white"
                              : UI_TOKENS.COLORS.whiteAlpha50
                          }
                          bg={!forceAnimations ? "white" : "transparent"}
                        />
                      </HStack>
                    </Box>
                    {/* 強制ON */}
                    <Box
                      cursor="pointer"
                      onClick={() => setForceAnimationsPersist(true)}
                      p={4}
                      borderRadius="0"
                      border="2px solid"
                      borderColor={
                        forceAnimations
                          ? UI_TOKENS.COLORS.whiteAlpha90
                          : UI_TOKENS.COLORS.whiteAlpha30
                      }
                      bg={
                        forceAnimations
                          ? UI_TOKENS.COLORS.whiteAlpha10
                          : UI_TOKENS.COLORS.panelBg
                      }
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
                          borderColor={
                            forceAnimations
                              ? "white"
                              : UI_TOKENS.COLORS.whiteAlpha50
                          }
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
                  <Text
                    fontSize="xs"
                    color={UI_TOKENS.COLORS.whiteAlpha60}
                    mt={1}
                  >
                    これは? →
                    「動きを減らす」は端末のアクセシビリティ設定です。目の疲れや酔いが出やすい方向けに、動きを少なくする指示をアプリに伝えます。
                  </Text>
                </Box>
              </Stack>
            )}
            {activeTab === "sound" && (
              SOUND_FEATURE_LOCKED ? (
                <SoundSettingsPlaceholder
                  locked={SOUND_FEATURE_LOCKED}
                  message={soundLockMessage}
                  masterVolume={soundSettings.masterVolume}
                  muted={soundSettings.muted}
                  soundManagerReady={Boolean(soundManager)}
                />
              ) : (
                <SoundSettingsPanel />
              )
            )}
          </Dialog.Body>

          {/* Footer - 統一パターン */}
          <Box
            p={6}
            pt={4}
            position="relative"
            zIndex={20}
            css={{
              background: "transparent",
              borderTop: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            }}
          >
            <HStack justify="space-between" gap={3}>
              <button
                onClick={closeWithSound}
                style={{
                  minWidth: "120px",
                  height: "40px",
                  borderRadius: "0",
                  fontWeight: 880,
                  fontSize: "1rem",
                  fontFamily: "monospace",
                  border: `2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
                  background: "transparent",
                  color: "white",
                  cursor: "pointer",
                  textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                  transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "white";
                  e.currentTarget.style.color = UI_TOKENS.COLORS.panelBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "white";
                }}
              >
                戻る
              </button>

              {activeTab === "game" ? (
                <button
                  onClick={handleSave}
                  disabled={saving || !isHost || roomStatus !== "waiting"}
                  style={{
                    minWidth: "140px",
                    height: "40px",
                    borderRadius: "0",
                    fontWeight: 880,
                    fontSize: "1rem",
                    fontFamily: "monospace",
                    border: `2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
                    background:
                      saving || !isHost || roomStatus !== "waiting"
                        ? "#666"
                        : UI_TOKENS.COLORS.panelBg,
                    color: "white",
                    cursor:
                      saving || !isHost || roomStatus !== "waiting"
                        ? "not-allowed"
                        : "pointer",
                    textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                    transition: `background-color 103ms cubic-bezier(.2,1,.3,1), color 103ms cubic-bezier(.2,1,.3,1), border-color 103ms cubic-bezier(.2,1,.3,1)`,
                    opacity:
                      saving || !isHost || roomStatus !== "waiting" ? 0.62 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!saving && isHost && roomStatus === "waiting") {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.color = UI_TOKENS.COLORS.panelBg;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!saving && isHost && roomStatus === "waiting") {
                      e.currentTarget.style.background = UI_TOKENS.COLORS.panelBg;
                      e.currentTarget.style.color = "white";
                    }
                  }}
                >
                  {saving ? "記録中..." : "記録"}
                </button>
              ) : (
                <Box
                  px={4}
                  py={2.5}
                  borderWidth="2px"
                  borderStyle="solid"
                  borderColor={UI_TOKENS.COLORS.whiteAlpha60}
                  bg={UI_TOKENS.COLORS.whiteAlpha10}
                  color={UI_TOKENS.COLORS.whiteAlpha80}
                  fontFamily="monospace"
                  fontSize="0.9rem"
                  minW="180px"
                  textAlign="center"
                  lineHeight="short"
                >
                  選択した内容は
                  <br />
                  即座に記録されます
                </Box>
              )}
            </HStack>
          </Box>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

export default SettingsModal;
