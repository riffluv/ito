"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { db } from "@/lib/firebase/client";
import type { RoomDoc } from "@/lib/types";
import { Box, Dialog, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { UI_TOKENS } from "@/theme/layout";

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
  const { animationMode, setAnimationMode, effectiveMode, gpuCapability } =
    useAnimationSettings();

  const [resolveMode, setResolveMode] = useState<string>(
    currentOptions?.resolveMode || "sort-submit"
  );
  const [defaultTopicType, setDefaultTopicType] = useState<string>(
    currentOptions?.defaultTopicType || "通常版"
  );
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"game" | "graphics">("game");

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
      notify({ title: "設定を保存しました", type: "success" });
      onClose();
    } catch (err: any) {
      notify({
        title: "設定の保存に失敗しました",
        description: err?.message,
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
  ];

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => !details.open && onClose()}
    >
      <Dialog.Backdrop 
        css={{
          background: "overlayStrong",
          backdropFilter: "blur(12px) saturate(1.2)",
        }}
      />
      <Dialog.Positioner>
        <Dialog.Content
          css={{
            background: UI_TOKENS.COLORS.panelBg,
            border: `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
            borderRadius: 0,
            boxShadow: UI_TOKENS.SHADOWS.panelDistinct,
            maxWidth: "480px",
            width: "90vw",
            padding: 0,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Close button - 統一パターン */}
          <Dialog.CloseTrigger 
            css={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 10,
              background: UI_TOKENS.COLORS.panelBg,
              borderRadius: 0,
              padding: '0',
              border: `2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
              color: 'white',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: `background-color 0.15s ${UI_TOKENS.EASING.standard}, color 0.15s ${UI_TOKENS.EASING.standard}, border-color 0.15s ${UI_TOKENS.EASING.standard}`,
              '&:hover': {
                background: 'white',
                color: UI_TOKENS.COLORS.panelBg
              }
            }}
          >
            ✕
          </Dialog.CloseTrigger>

          {/* Header - 統一パターン */}
          <Box 
            p={6} 
            position="relative"
            zIndex={1}
            css={{
              borderBottom: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            }}
          >
            <Dialog.Title 
              css={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: 'white',
                margin: 0,
                fontFamily: 'monospace',
                textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                textAlign: 'center',
              }}
            >
              せっていを かえる
            </Dialog.Title>
            <Text 
              fontSize="sm" 
              color={UI_TOKENS.COLORS.textMuted}
              mt={1}
              css={{
                textAlign: 'center',
              }}
            >
              あそびかたを きめてください
            </Text>
          </Box>

          <Dialog.Body px={6} pb={2}>
            {/* タブ切り替え */}
            <HStack gap={3} mb={4} justify="center">
              {[
                { key: "game", label: "Game Settings" },
                { key: "graphics", label: "Graphics Settings" },
              ].map((t) => {
                const isActive = activeTab === (t.key as any);
                return (
                  <Box
                    key={t.key}
                    as="button"
                    onClick={() => setActiveTab(t.key as any)}
                    px={4}
                    py={2}
                    borderRadius={0}
                    border="2px solid"
                    borderColor={isActive ? UI_TOKENS.COLORS.whiteAlpha90 : UI_TOKENS.COLORS.whiteAlpha30}
                    bg={isActive ? "rgba(255,255,255,0.1)" : UI_TOKENS.COLORS.panelBg}
                    color="white"
                    fontFamily="monospace"
                    fontWeight="bold"
                    transition={`background-color 0.12s ${UI_TOKENS.EASING.standard}, color 0.12s ${UI_TOKENS.EASING.standard}, border-color 0.12s ${UI_TOKENS.EASING.standard}`}
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
                        borderRadius={0}
                        border="2px solid"
                        borderColor={isSelected ? UI_TOKENS.COLORS.whiteAlpha90 : UI_TOKENS.COLORS.whiteAlpha30}
                        bg={isSelected ? "rgba(255,255,255,0.1)" : UI_TOKENS.COLORS.panelBg}
                        transition={`background-color 0.15s ${UI_TOKENS.EASING.standard}, border-color 0.15s ${UI_TOKENS.EASING.standard}, box-shadow 0.15s ${UI_TOKENS.EASING.standard}`}
                        boxShadow={isSelected ? UI_TOKENS.SHADOWS.panelDistinct : UI_TOKENS.SHADOWS.panelSubtle}
                        _hover={{
                          borderColor: UI_TOKENS.COLORS.whiteAlpha80,
                          bg: isSelected ? "rgba(255,255,255,0.15)" : UI_TOKENS.COLORS.panelBg,
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
                            borderRadius={0}
                            border="2px solid"
                            borderColor={isSelected ? "white" : UI_TOKENS.COLORS.whiteAlpha50}
                            bg={isSelected ? "white" : "transparent"}
                            mt={0.5}
                            position="relative"
                            transition={`background-color 0.15s ${UI_TOKENS.EASING.standard}, border-color 0.15s ${UI_TOKENS.EASING.standard}`}
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
                                fontWeight="900"
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
                        borderRadius={0}
                        border="2px solid"
                        borderColor={isSelected ? UI_TOKENS.COLORS.whiteAlpha90 : UI_TOKENS.COLORS.whiteAlpha30}
                        bg={isSelected ? "rgba(255,255,255,0.1)" : UI_TOKENS.COLORS.panelBg}
                        transition={`background-color 0.15s ${UI_TOKENS.EASING.standard}, border-color 0.15s ${UI_TOKENS.EASING.standard}, box-shadow 0.15s ${UI_TOKENS.EASING.standard}`}
                        boxShadow={isSelected ? UI_TOKENS.SHADOWS.panelDistinct : UI_TOKENS.SHADOWS.panelSubtle}
                        _hover={{
                          borderColor: UI_TOKENS.COLORS.whiteAlpha80,
                          bg: isSelected ? "rgba(255,255,255,0.15)" : UI_TOKENS.COLORS.panelBg,
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
                            borderRadius={0}
                            border="2px solid"
                            borderColor={isSelected ? "white" : UI_TOKENS.COLORS.whiteAlpha50}
                            bg={isSelected ? "white" : "transparent"}
                            mt={0.5}
                            position="relative"
                              transition={`background-color 0.15s ${UI_TOKENS.EASING.standard}, border-color 0.15s ${UI_TOKENS.EASING.standard}`}
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
                                fontWeight="900"
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
                  p={3}
                  bg="yellow.900"
                  borderRadius="md"
                  border="1px solid"
                  borderColor="yellow.700"
                >
                  <Text fontSize="sm" color="yellow.300" textAlign="center">
                    {!isHost
                      ? "せっていは ホストのみ かえられます"
                      : "せっていは たいきちゅうのみ かえられます"}
                  </Text>
                </Box>
              )}
              </Stack>
            )}

            {activeTab === "graphics" && (
              <Stack gap={6}>
                <Box>
                  <Text fontSize="sm" fontWeight="600" color="gray.300" mb={1}>
                    アニメーション モード
                  </Text>
                  <Text fontSize="xs" color="rgba(255,255,255,0.7)" mb={3}>
                    げんざい: {effectiveMode === "3d" ? "高品質 3D" : "シンプル"}
                    （自動判定: {gpuCapability === "high" ? "高" : "低"}）
                  </Text>
                  <Stack gap={2}>
                    {[
                      {
                        value: "auto",
                        title: "自動おすすめ設定",
                        description: "PCの せいのうに あわせて さいてき",
                      },
                      {
                        value: "3d",
                        title: "高品質 3D",
                        description: "3D回転アニメーション",
                      },
                      {
                        value: "simple",
                        title: "シンプル",
                        description: "軽量表示切り替え",
                      },
                    ].map((opt) => {
                      const isSelected = animationMode === (opt.value as any);
                      return (
                        <Box
                          key={opt.value}
                          cursor="pointer"
                          onClick={() => setAnimationMode(opt.value as any)}
                          p={4}
                          borderRadius={0}
                          border="2px solid"
                          borderColor={
                            isSelected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)"
                          }
                          bg={isSelected ? "rgba(255,255,255,0.1)" : "rgba(8,9,15,0.7)"}
                          transition="background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease"
                          boxShadow={
                            isSelected
                              ? "inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)"
                              : "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.2)"
                          }
                          _hover={{
                            borderColor: "rgba(255,255,255,0.8)",
                            bg: isSelected ? "rgba(255,255,255,0.15)" : "rgba(8,9,15,0.8)",
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
                                color="rgba(255,255,255,0.7)"
                                lineHeight="short"
                                fontFamily="monospace"
                              >
                                {opt.description}
                              </Text>
                            </VStack>
                            <Box
                              w={5}
                              h={5}
                              borderRadius={0}
                              border="2px solid"
                              borderColor={isSelected ? "white" : "rgba(255,255,255,0.5)"}
                              bg={isSelected ? "white" : "transparent"}
                              mt={0.5}
                              position="relative"
                              transition="background-color 0.15s ease, border-color 0.15s ease"
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
                                  fontWeight="900"
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
              </Stack>
            )}
          </Dialog.Body>

          {/* Footer - 統一パターン */}
          <Box 
            p={6} 
            pt={4}
            css={{
              background: 'transparent',
              borderTop: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            }}
          >
            <HStack justify="space-between" gap={3}>
              <button
                onClick={onClose}
                style={{
                  minWidth: "120px",
                  height: "40px",
                  borderRadius: 0,
                  fontWeight: "bold",
                  fontSize: "1rem",
                  fontFamily: "monospace",
                  border: `2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
                  background: "transparent",
                  color: "white",
                  cursor: "pointer",
                  textShadow: UI_TOKENS.TEXT_SHADOWS.soft as any,
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
                やめる
              </button>

              <button
                onClick={handleSave}
                disabled={saving || !isHost || roomStatus !== "waiting"}
                style={{
                  minWidth: "140px",
                  height: "40px",
                  borderRadius: 0,
                  fontWeight: "bold",
                  fontSize: "1rem",
                  fontFamily: "monospace",
                  border: `2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
                  background: saving || !isHost || roomStatus !== "waiting" ? "#666" : UI_TOKENS.COLORS.panelBg,
                  color: "white",
                  cursor: saving || !isHost || roomStatus !== "waiting" ? "not-allowed" : "pointer",
                  textShadow: UI_TOKENS.TEXT_SHADOWS.soft as any,
                  transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                  opacity: saving || !isHost || roomStatus !== "waiting" ? 0.6 : 1,
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
                {saving ? "きろくちゅう..." : "きろく"}
              </button>
            </HStack>
          </Box>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

export default SettingsModal;
