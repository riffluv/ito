"use client";

import { AppButton } from "@/components/ui/AppButton";
import Tooltip from "@/components/ui/Tooltip";
import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { Box, Flex, HStack, Input } from "@chakra-ui/react";
import React from "react";
import { DiamondNumberCard } from "../DiamondNumberCard";
import { FOOTER_BUTTON_BASE_STYLES } from "../miniHandDockStyles";

type BottomActionDockProps = {
  visible: boolean;
  interactionDisabled: boolean;
  pop: boolean;
  number: number | null;
  inputRef: React.RefObject<HTMLInputElement>;
  text: string;
  onTextChange: (value: string) => void;
  onInputKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  clueEditable: boolean;
  preparing: boolean;
  decideTooltip: string;
  clearTooltip: string;
  submitTooltip: string;
  onDecide: () => void | Promise<unknown>;
  onClear: () => void | Promise<unknown>;
  onSubmit: () => void | Promise<unknown>;
  canDecide: boolean;
  clearButtonDisabled: boolean;
  canSubmit: boolean;
  actionLabel: string;
  hostControls?: React.ReactNode;
};

export function BottomActionDock(props: BottomActionDockProps) {
  const {
    visible,
    interactionDisabled,
    pop,
    number,
    inputRef,
    text,
    onTextChange,
    onInputKeyDown,
    clueEditable,
    preparing,
    decideTooltip,
    clearTooltip,
    submitTooltip,
    onDecide,
    onClear,
    onSubmit,
    canDecide,
    clearButtonDisabled,
    canSubmit,
    actionLabel,
    hostControls,
  } = props;

  if (!visible) return null;

  return (
    <Flex
      position="fixed"
      bottom={{ base: scaleForDpi("20px"), md: scaleForDpi("24px") }}
      left="50%"
      transform="translateX(-50%)"
      zIndex={50}
      data-guide-target="mini-hand-dock"
      gap={{ base: scaleForDpi("10px"), md: scaleForDpi("14px") }}
      align="center"
      justify="center"
      flexWrap="nowrap"
      maxW="95vw"
      pointerEvents={interactionDisabled ? "none" : "auto"}
    >
      <Box
        flexShrink={0}
        transform={{ base: "scale(1.1)", md: "scale(1.2)" }}
        transformOrigin="left center"
        mr={{ base: scaleForDpi("14px"), md: scaleForDpi("20px") }}
      >
        <DiamondNumberCard number={number} isAnimating={pop} />
      </Box>

      <HStack gap={{ base: scaleForDpi("8px"), md: scaleForDpi("10px") }} flexWrap="nowrap">
        <Input
          ref={inputRef}
          aria-label="連想ワード"
          placeholder="連想ワード..."
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={onInputKeyDown}
          data-guide-target="association-input"
          maxLength={50}
          size="md"
          bg="rgba(18,22,32,0.85)"
          color="rgba(255,255,255,0.98)"
          fontFamily="'Courier New', monospace"
          fontSize={{ base: scaleForDpi("14px"), md: scaleForDpi("16px") }}
          fontWeight="700"
          letterSpacing="0.02em"
          border="none"
          borderRadius={scaleForDpi("3px")}
          boxShadow={`inset ${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(0,0,0,0.5), 0 0 0 ${scaleForDpi("1px")} rgba(255,255,255,0.25)`}
          h={scaleForDpi("40px")}
          minH={scaleForDpi("40px")}
          w={{ base: scaleForDpi("200px"), md: scaleForDpi("280px") }}
          transition="box-shadow 150ms ease"
          disabled={!clueEditable || preparing}
          _placeholder={{
            color: "rgba(255,255,255,0.35)",
          }}
          _focus={{
            boxShadow:
              `inset ${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(0,0,0,0.5), 0 0 0 ${scaleForDpi("1px")} rgba(255,255,255,0.4)`,
            bg: "rgba(22,26,36,0.9)",
            outline: "none",
          }}
          _disabled={{
            opacity: 0.5,
            cursor: "not-allowed",
          }}
        />
        <Tooltip content={decideTooltip} showArrow openDelay={180}>
          <AppButton
            {...FOOTER_BUTTON_BASE_STYLES}
            size="sm"
            visual="solid"
            palette="brand"
            onClick={() => void onDecide()}
            disabled={preparing || !canDecide || interactionDisabled}
            w="auto"
            minW={scaleForDpi("60px")}
          >
            決定
          </AppButton>
        </Tooltip>
        <Tooltip content={clearTooltip} showArrow openDelay={180}>
          <AppButton
            {...FOOTER_BUTTON_BASE_STYLES}
            size="sm"
            visual="outline"
            palette="gray"
            onClick={() => void onClear()}
            disabled={clearButtonDisabled || interactionDisabled}
            w="auto"
            minW={scaleForDpi("60px")}
          >
            クリア
          </AppButton>
        </Tooltip>
        <Tooltip content={submitTooltip} showArrow openDelay={180}>
          <AppButton
            {...FOOTER_BUTTON_BASE_STYLES}
            size="sm"
            visual="solid"
            palette="brand"
            onClick={() => void onSubmit()}
            disabled={!canSubmit || interactionDisabled}
            w="auto"
            minW={scaleForDpi("70px")}
          >
            {actionLabel}
          </AppButton>
        </Tooltip>
      </HStack>

      {hostControls}
    </Flex>
  );
}

