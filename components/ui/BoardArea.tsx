"use client";
import { Box, BoxProps } from "@chakra-ui/react";
import React from "react";

export type BoardAreaProps = BoxProps & {
  isOver?: boolean;
};

export default function BoardArea({ isOver, children, ...rest }: BoardAreaProps) {
  return (
    <Box position="relative">
      <Box
        role="region"
        aria-label="カード配置エリア"
        position="relative"
        minH="220px"
        borderWidth="2px"
        borderStyle="dashed"
        borderColor={isOver ? "accent" : "whiteAlpha.200"}
        rounded="12px"
        p={4}
        display="flex"
        gap={4}
        alignItems="center"
        flexWrap="wrap"
        bg={
          isOver
            ? "rgba(78,205,196,0.04)"
            : "repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 8px, transparent 8px, transparent 16px)"
        }
        transition="all 150ms ease"
        {...rest}
      >
        {children}
      </Box>
    </Box>
  );
}

