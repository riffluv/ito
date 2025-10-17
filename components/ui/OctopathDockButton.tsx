"use client";

import { forwardRef } from "react";
import type { ReactNode } from "react";
import {
  Box,
  Button as ChakraButton,
  Spinner,
  Text,
  type ButtonProps,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";

export type OctopathDockButtonProps = ButtonProps & {
  label?: string;
  subLabel?: string;
  icon?: ReactNode;
  isLoading?: boolean;
  compact?: boolean;
  iconBoxSize?: number;
};

const dockGlint = keyframes`
  0% { transform: translateX(-40%) rotate(11deg); opacity: 0.24; }
  7% { transform: translateX(-35%) rotate(11deg); opacity: 0.31; }
  32% { transform: translateX(22%) rotate(11deg); opacity: 0.48; }
  58% { transform: translateX(68%) rotate(11deg); opacity: 0.29; }
  71% { transform: translateX(85%) rotate(11deg); opacity: 0.35; }
  100% { transform: translateX(120%) rotate(11deg); opacity: 0.19; }
`;

export const OctopathDockButton = forwardRef<HTMLButtonElement, OctopathDockButtonProps>(
  (
    {
      label,
      subLabel,
      icon,
      isLoading = false,
      disabled,
      minW,
      compact = false,
      iconBoxSize,
      ...rest
    },
    ref
  ) => {
    const finalDisabled = Boolean(disabled || isLoading);
    const playPress = useSoundEffect("ui_click");

    const baseMinW = minW ?? (compact ? "52px" : "220px");
    const baseMinH = compact ? "40px" : "48px";
    const resolvedIconSize = iconBoxSize ?? (compact ? 18 : 20);

    return (
      <ChakraButton
        ref={ref}
        variant="ghost"
        minW={baseMinW}
        minH={baseMinH}
        px={compact ? "10px" : "18px"}
        py={compact ? "6px" : "10px"}
        display="flex"
        alignItems="center"
        justifyContent={compact ? "center" : "space-between"}
        gap={compact ? 0 : 4}
        position="relative"
        overflow="hidden"
        borderRadius="0"
        background="rgba(8,9,15,0.95)"
        border="none"
        color="rgba(255,255,255,0.98)"
        fontFamily="'Courier New', monospace"
        fontWeight="900"
        letterSpacing="0.05em"
        textShadow="2px 2px 0 rgba(0,0,0,0.9)"
        boxShadow="3px 3px 0 rgba(0,0,0,.65), 0 0 0 2px rgba(255,255,255,0.88)"
        transition="transform 0.17s ease, box-shadow 0.17s ease, filter 0.17s ease"
        filter={finalDisabled ? "grayscale(0.5) brightness(0.7)" : undefined}
        cursor={finalDisabled ? "default" : "pointer"}
        onPointerDown={(event) => {
          if (finalDisabled) return;
          playPress();
          rest.onPointerDown?.(event);
        }}
        onMouseEnter={(event) => {
          rest.onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          rest.onMouseLeave?.(event);
        }}
        _hover={{
          transform: finalDisabled ? undefined : "translate(0,-2px)",
          boxShadow: finalDisabled
            ? undefined
            : "4px 5px 0 rgba(0,0,0,.7), 0 0 0 2px rgba(255,255,255,0.95)",
          background: finalDisabled ? undefined : "rgba(12,13,18,0.98)",
        }}
        _active={{
          transform: "translate(1px,1px)",
          boxShadow: "2px 2px 0 rgba(0,0,0,.75), 0 0 0 2px rgba(255,255,255,0.82)",
          background: "rgba(5,6,10,1)",
        }}
        _focusVisible={{
          outline: "none",
          boxShadow: "0 0 0 2px rgba(128, 186, 255, 0.45), 0 0 0 4px rgba(20, 40, 92, 0.5)",
        }}
        _disabled={{
          opacity: 1,
        }}
        disabled={finalDisabled}
        {...rest}
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent={compact ? "center" : "space-between"}
          gap={compact ? 0 : 3}
          flex={compact ? undefined : 1}
          minW={0}
          w="100%"
          position="relative"
        >
          {icon ? (
            <Box
              fontSize="lg"
              color="rgba(255,255,255,0.98)"
              filter="drop-shadow(0 2px 6px rgba(0,0,0,0.6))"
              display="flex"
              alignItems="center"
              justifyContent="center"
              w={`${resolvedIconSize}px`}
              h={`${resolvedIconSize}px`}
              flexShrink={0}
            >
              {icon}
            </Box>
          ) : null}
          {!compact ? (
            <Box minW={0} textAlign="left">
              {label ? (
                <Text
                  fontSize="sm"
                  fontWeight={800}
                  letterSpacing="0.32px"
                  lineHeight="1.1"
                  color="rgba(249, 244, 232, 0.95)"
                  css={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {label}
                </Text>
              ) : null}
              {subLabel ? (
                <Text
                  fontSize="xs"
                  fontWeight={500}
                  letterSpacing="0.28px"
                  color="rgba(230, 222, 204, 0.78)"
                  lineHeight="1.1"
                  mt="2px"
                  css={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {subLabel}
                </Text>
              ) : null}
            </Box>
          ) : null}
          {isLoading ? (
            <Spinner
              size="xs"
              color="rgba(240, 220, 180, 0.85)"
              position={compact ? "absolute" : "static"}
              right={compact ? "6px" : undefined}
            />
          ) : null}
        </Box>
      </ChakraButton>
    );
  }
);

OctopathDockButton.displayName = "OctopathDockButton";

export default OctopathDockButton;
