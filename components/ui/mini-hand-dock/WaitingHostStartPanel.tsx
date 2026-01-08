"use client";

import { AppButton } from "@/components/ui/AppButton";
import { Box, Text } from "@chakra-ui/react";
import React from "react";
import {
  MINI_HAND_DOCK_FLOATING_CENTER_BOTTOM,
  orangeGlowStart,
  subtleTextPulse,
} from "../miniHandDockStyles";
import { SEINO_BUTTON_STYLES } from "../seinoButtonStyles";

type WaitingHostStartPanelProps = {
  isHost: boolean;
  hostClaimMessage: string;
  presenceCanStart: boolean;
  quickStartPending: boolean;
  interactionDisabled: boolean;
  onStart: () => void | Promise<unknown>;
  presenceReady: boolean;
  presenceDegraded: boolean;
  presenceForceEligible: boolean;
  presenceWaitRemainingMs: number;
};

export function WaitingHostStartPanel(props: WaitingHostStartPanelProps) {
  const {
    isHost,
    hostClaimMessage,
    presenceCanStart,
    quickStartPending,
    interactionDisabled,
    onStart,
    presenceReady,
    presenceDegraded,
    presenceForceEligible,
    presenceWaitRemainingMs,
  } = props;

  return (
    <Box
      position="fixed"
      bottom={MINI_HAND_DOCK_FLOATING_CENTER_BOTTOM}
      left="50%"
      transform="translateX(-50%)"
      zIndex={55}
    >
      {isHost ? (
        <AppButton
          {...SEINO_BUTTON_STYLES}
          size="lg"
          visual="solid"
          onClick={() => void onStart()}
          disabled={!presenceCanStart || quickStartPending || interactionDisabled}
          css={{
            animation: `${orangeGlowStart} 3.2s cubic-bezier(.42,.15,.58,.85) infinite`,
          }}
        >
          ゲーム開始
        </AppButton>
      ) : (
        <Text
          fontSize="sm"
          fontWeight="bold"
          color="rgba(255,255,255,0.95)"
          textAlign="left"
          animation={`${subtleTextPulse} 1.6s ease-in-out infinite`}
        >
          {hostClaimMessage}
        </Text>
      )}
      {isHost && !presenceReady && !presenceDegraded && !presenceForceEligible ? (
        <Text
          mt={2}
          fontSize="xs"
          fontWeight="bold"
          color="rgba(255,255,255,0.75)"
          textAlign="center"
        >
          参加者の接続を待っています…（あと{Math.ceil(presenceWaitRemainingMs / 1000)}秒）
        </Text>
      ) : null}
      {isHost && !presenceReady && (presenceDegraded || presenceForceEligible) ? (
        <Text
          mt={2}
          fontSize="xs"
          fontWeight="bold"
          color="rgba(255,255,255,0.75)"
          textAlign="center"
        >
          接続未確認ですが開始できます
        </Text>
      ) : null}
    </Box>
  );
}
