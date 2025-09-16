"use client";
import { Text } from "@chakra-ui/react";
import React from "react";
import { UI_TOKENS } from "@/theme/layout";

interface DiamondNumberCardProps {
  number: number | null;
  isAnimating?: boolean;
}

export function DiamondNumberCard({ number, isAnimating = false }: DiamondNumberCardProps) {
  return (
    <Text
      fontSize="32px"
      fontWeight="900"
      color={UI_TOKENS.COLORS.textBase}
      fontFamily="monospace"
      textShadow="2px 2px 0px rgba(0,0,0,0.8), 1px 1px 0px rgba(0,0,0,0.6)"
      transition={isAnimating ? `transform 0.18s ${UI_TOKENS.EASING.standard}` : "none"}
      transform={isAnimating ? "scale(1.1)" : "scale(1)"}
      flexShrink={0}
      lineHeight="1"
      display="flex"
      alignItems="center"
      justifyContent="center"
      minW="40px"
      h="40px"
    >
      {typeof number === "number" ? number : "?"}
    </Text>
  );
}