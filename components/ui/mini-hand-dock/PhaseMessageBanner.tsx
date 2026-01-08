"use client";

import { Box, Text } from "@chakra-ui/react";
import React from "react";
import { phaseMessagePulse } from "../miniHandDockStyles";

type PhaseMessageBannerProps = {
  message: string | null | undefined;
  bottom: { base: string; md: string };
};

export function PhaseMessageBanner(props: PhaseMessageBannerProps) {
  const { message, bottom } = props;
  if (!message) return null;

  return (
    <Box
      position="fixed"
      bottom={bottom}
      left="50%"
      transform="translateX(-50%)"
      zIndex={55}
      pointerEvents="none"
    >
      <Text
        display="inline-block"
        fontSize="0.85rem"
        fontWeight="bold"
        color="rgba(255,255,255,0.95)"
        letterSpacing="0.04em"
        textAlign="center"
        textShadow="0 1px 3px rgba(0,0,0,0.55)"
        whiteSpace="nowrap"
        animation={`${phaseMessagePulse} 1.7s ease-in-out infinite`}
      >
        {message}
      </Text>
    </Box>
  );
}
