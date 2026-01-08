"use client";

import Tooltip from "@/components/ui/Tooltip";
import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { Box, HStack, IconButton } from "@chakra-ui/react";
import React from "react";
import { FiEdit2, FiLogOut, FiSettings } from "react-icons/fi";
import {
  MINI_HAND_DOCK_ICON_BUTTON_BASE_STYLES,
  MINI_HAND_DOCK_ICON_BUTTON_DANGER_ACTIVE_STYLES,
  MINI_HAND_DOCK_ICON_BUTTON_DANGER_HOVER_STYLES,
} from "../miniHandDockStyles";

type RightEdgeControlsProps = {
  showCustomTopicPen: boolean;
  showLedgerButton: boolean;
  interactionDisabled: boolean;
  onOpenCustomTopic: () => void;
  onOpenSettings?: () => void;
  onLeaveRoom?: () => void | Promise<void>;
};

export function RightEdgeControls(props: RightEdgeControlsProps) {
  const {
    showCustomTopicPen,
    showLedgerButton,
    interactionDisabled,
    onOpenCustomTopic,
    onOpenSettings,
    onLeaveRoom,
  } = props;

  return (
    <Box
      position="fixed"
      bottom={{ base: scaleForDpi("16px"), md: scaleForDpi("20px") }}
      right={{ base: scaleForDpi("32px"), md: scaleForDpi("32px") }}
      zIndex={50}
    >
      <HStack gap={scaleForDpi("10px")} align="center">
        {showCustomTopicPen && (
          <Tooltip content="カスタムお題を設定" showArrow openDelay={300}>
            <IconButton
              {...MINI_HAND_DOCK_ICON_BUTTON_BASE_STYLES}
              aria-label="カスタムお題"
              onClick={() => void onOpenCustomTopic()}
              disabled={interactionDisabled}
              size="sm"
              w={scaleForDpi("40px")}
              h={scaleForDpi("40px")}
              fontSize={scaleForDpi("16px")}
              transition="176ms cubic-bezier(.2,1,.3,1)"
            >
              <FiEdit2 />
            </IconButton>
          </Tooltip>
        )}
        {showLedgerButton && null}
        {onOpenSettings && (
          <Tooltip content="設定を開く" showArrow openDelay={180}>
            <IconButton
              {...MINI_HAND_DOCK_ICON_BUTTON_BASE_STYLES}
              aria-label="設定"
              onClick={onOpenSettings}
              size="xs"
              w={scaleForDpi("36px")}
              h={scaleForDpi("36px")}
              fontSize={scaleForDpi("15px")}
              transition="175ms cubic-bezier(.2,1,.3,1)"
            >
              <FiSettings />
            </IconButton>
          </Tooltip>
        )}
        {onLeaveRoom && (
          <Tooltip content="ロビーに戻る" showArrow openDelay={180}>
            <IconButton
              {...MINI_HAND_DOCK_ICON_BUTTON_BASE_STYLES}
              aria-label="退出"
              onClick={() => void onLeaveRoom()}
              size="xs"
              w={scaleForDpi("36px")}
              h={scaleForDpi("36px")}
              fontSize={scaleForDpi("15px")}
              _hover={MINI_HAND_DOCK_ICON_BUTTON_DANGER_HOVER_STYLES}
              _active={MINI_HAND_DOCK_ICON_BUTTON_DANGER_ACTIVE_STYLES}
              transition="173ms cubic-bezier(.2,1,.3,1)"
            >
              <FiLogOut />
            </IconButton>
          </Tooltip>
        )}
      </HStack>
    </Box>
  );
}

