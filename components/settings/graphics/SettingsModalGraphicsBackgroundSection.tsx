"use client";

import { UI_TOKENS } from "@/theme/layout";
import {
  BACKGROUND_LABEL_MAP,
  BACKGROUND_OPTIONS,
  SCENERY_VARIANTS,
  getVariantFromBackground,
  type BackgroundOption,
  type SceneryVariant,
} from "@/components/settings/settingsModalModel";
import { Box, HStack, Stack, Text, VStack } from "@chakra-ui/react";

export type SettingsModalGraphicsBackgroundSectionProps = {
  backgroundType: BackgroundOption;
  onBackgroundChange: (next: BackgroundOption) => void;
  onVariantChange: (variant: SceneryVariant) => void;
};

export function SettingsModalGraphicsBackgroundSection(
  props: SettingsModalGraphicsBackgroundSectionProps
) {
  const { backgroundType, onBackgroundChange, onVariantChange } = props;

  return (
    <>
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
                      isScenerySelected ? "white" : UI_TOKENS.COLORS.whiteAlpha50
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
                isSelected ? UI_TOKENS.COLORS.whiteAlpha90 : UI_TOKENS.COLORS.whiteAlpha30
              }
              bg={isSelected ? UI_TOKENS.COLORS.whiteAlpha10 : UI_TOKENS.COLORS.panelBg}
              transition={`background-color 177ms cubic-bezier(.2,1,.3,1), border-color 177ms cubic-bezier(.2,1,.3,1), box-shadow 177ms cubic-bezier(.2,1,.3,1)`}
              boxShadow={
                isSelected ? UI_TOKENS.SHADOWS.panelDistinct : UI_TOKENS.SHADOWS.panelSubtle
              }
              _hover={{
                borderColor: UI_TOKENS.COLORS.whiteAlpha80,
                bg: isSelected ? UI_TOKENS.COLORS.whiteAlpha15 : UI_TOKENS.COLORS.panelBg,
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
                  borderColor={isSelected ? "white" : UI_TOKENS.COLORS.whiteAlpha50}
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
    </>
  );
}

