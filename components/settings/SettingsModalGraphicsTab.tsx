"use client";

import { UI_TOKENS } from "@/theme/layout";
import { Box, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import {
  BACKGROUND_LABEL_MAP,
  BACKGROUND_OPTIONS,
  CARD_ANIMATION_OPTIONS,
  GRAPHICS_TABS,
  SCENERY_VARIANTS,
  getVariantFromBackground,
  type AnimationModeOption,
  type BackgroundOption,
  type CardAnimationOption,
  type GraphicsTab,
  type SceneryVariant,
} from "@/components/settings/settingsModalModel";

export function SettingsModalGraphicsTab(props: {
  graphicsTab: GraphicsTab;
  onGraphicsTabChange: (next: GraphicsTab) => void;
  backgroundType: BackgroundOption;
  onBackgroundChange: (next: BackgroundOption) => void;
  onVariantChange: (variant: SceneryVariant) => void;
  gpuCapability?: "high" | "low";
  supports3D?: boolean;
  animationMode: AnimationModeOption;
  effectiveMode: CardAnimationOption;
  force3DTransforms: boolean;
  onForce3DTransformsChange: (next: boolean) => void;
  onAnimationModeChange: (next: AnimationModeOption) => void;
  forceAnimations: boolean;
  osReduced: boolean;
  onForceAnimationsChange: (next: boolean) => void;
}) {
  const {
    graphicsTab,
    onGraphicsTabChange,
    backgroundType,
    onBackgroundChange,
    onVariantChange,
    gpuCapability,
    supports3D,
    animationMode,
    effectiveMode,
    force3DTransforms,
    onForce3DTransformsChange,
    onAnimationModeChange,
    forceAnimations,
    osReduced,
    onForceAnimationsChange,
  } = props;

  return (
    <Stack gap={6} mt={4}>
      <HStack gap={3} justify="center">
        {GRAPHICS_TABS.map((t) => {
          const isActive = graphicsTab === t.key;
          return (
            <Box
              key={t.key}
              as="button"
              onClick={() => onGraphicsTabChange(t.key)}
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

      <Box hidden={graphicsTab !== "background"}>
        <Text fontSize="sm" fontWeight="600" color="gray.300" mb={1}>
          はいけい モード
        </Text>
        <Text fontSize="xs" color={UI_TOKENS.COLORS.textMuted} mb={3}>
          げんざい: {BACKGROUND_LABEL_MAP[backgroundType]}
        </Text>
        <Stack gap={2}>
          {BACKGROUND_OPTIONS.map((opt) => {
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
                        onVariantChange("night");
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
                  <Stack mt={3} gap={2}>
                    {SCENERY_VARIANTS.map((variant) => {
                      const isSelected = currentVariant === variant.value;
                      return (
                        <Box
                          key={variant.value}
                          cursor="pointer"
                          onClick={() => onVariantChange(variant.value)}
                          p={3}
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
                                {variant.label}
                              </Text>
                              <Text
                                fontSize="sm"
                                color={UI_TOKENS.COLORS.textMuted}
                                lineHeight="short"
                                fontFamily="monospace"
                              >
                                {variant.description}
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
              );
            }

            const backgroundValue = opt.value as BackgroundOption;
            const isSelected = backgroundType === backgroundValue;
            return (
              <Box
                key={opt.value}
                cursor="pointer"
                onClick={() => onBackgroundChange(backgroundValue)}
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
                      isSelected ? "white" : UI_TOKENS.COLORS.whiteAlpha50
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
          現在: {force3DTransforms ? "3D回転" : "シンプル"}（推定GPU:{" "}
          {gpuCapability === "high" ? "高" : "低"}）
        </Text>
        {effectiveMode === "simple" &&
          animationMode !== "simple" &&
          supports3D === false && (
            <Text fontSize="xs" color={UI_TOKENS.COLORS.whiteAlpha60} mb={3}>
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
              onAnimationModeChange(opt.value);
              onForce3DTransformsChange(opt.value === "3d");
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
                      isSelected ? "white" : UI_TOKENS.COLORS.whiteAlpha50
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
          アニメの基準（どちらを優先するか）
        </Text>
        <Text fontSize="xs" color={UI_TOKENS.COLORS.textMuted} mb={2}>
          端末の設定: 動きを減らす = {osReduced ? "ON" : "OFF"}
        </Text>
        <Stack gap={2}>
          <Box
            cursor="pointer"
            onClick={() => onForceAnimationsChange(false)}
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
                  !forceAnimations ? "white" : UI_TOKENS.COLORS.whiteAlpha50
                }
                bg={!forceAnimations ? "white" : "transparent"}
              />
            </HStack>
          </Box>
          <Box
            cursor="pointer"
            onClick={() => onForceAnimationsChange(true)}
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
                  forceAnimations ? "white" : UI_TOKENS.COLORS.whiteAlpha50
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
        <Text fontSize="xs" color={UI_TOKENS.COLORS.whiteAlpha60} mt={1}>
          これは? →
          「動きを減らす」は端末のアクセシビリティ設定です。目の疲れや酔いが出やすい方向けに、動きを少なくする指示をアプリに伝えます。
        </Text>
      </Box>
    </Stack>
  );
}

