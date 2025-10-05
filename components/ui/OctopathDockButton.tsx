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
};

const dockGlint = keyframes`
  0% { transform: translateX(-40%) rotate(12deg); opacity: 0.28; }
  35% { transform: translateX(25%) rotate(12deg); opacity: 0.5; }
  65% { transform: translateX(70%) rotate(12deg); opacity: 0.3; }
  100% { transform: translateX(120%) rotate(12deg); opacity: 0.22; }
`;

export const OctopathDockButton = forwardRef<HTMLButtonElement, OctopathDockButtonProps>(
  (
    { label, subLabel, icon, isLoading = false, disabled, minW, compact = false, ...rest },
    ref
  ) => {
    const finalDisabled = Boolean(disabled || isLoading);
    const playPress = useSoundEffect("ui_click");

    const baseMinW = minW ?? (compact ? "52px" : "220px");
    const baseMinH = compact ? "40px" : "48px";

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
        borderRadius="4px"
        background="linear-gradient(137deg, rgba(24,28,48,0.96) 0%, rgba(12,16,32,0.92) 100%)"
        border="1px solid rgba(214, 182, 124, 0.32)"
        color="rgba(247, 244, 230, 0.92)"
        textShadow="0 1px 2px rgba(0,0,0,0.78)"
        boxShadow="0 12px 26px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.08)"
        transition="transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease"
        filter={finalDisabled ? "grayscale(0.35) brightness(0.85)" : undefined}
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
          transform: finalDisabled ? undefined : "translateY(-2px)",
          boxShadow: finalDisabled
            ? undefined
            : "0 18px 32px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.14)",
          borderColor: finalDisabled ? undefined : "rgba(238, 206, 150, 0.48)",
        }}
        _active={{
          transform: "translateY(0px)",
          boxShadow: "0 10px 20px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
        _focusVisible={{
          outline: "none",
          boxShadow: "0 0 0 2px rgba(128, 186, 255, 0.45), 0 0 0 4px rgba(20, 40, 92, 0.5)",
        }}
        _before={{
          content: "''",
          position: "absolute",
          inset: "-60% -20%",
          background:
            "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.22), rgba(120, 160, 255, 0.08) 45%, transparent 65%)",
          transform: "translateX(-40%) rotate(12deg)",
          opacity: 0.45,
          mixBlendMode: "screen",
          pointerEvents: "none",
          animation: `${dockGlint} 6.8s linear infinite`,
        }}
        _after={{
          content: "''",
          position: "absolute",
          inset: "-2px",
          borderRadius: "6px",
          border: "1px solid rgba(255,255,255,0.06)",
          pointerEvents: "none",
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
              color="rgba(255, 236, 200, 0.9)"
              filter="drop-shadow(0 2px 6px rgba(0,0,0,0.6))"
              display="flex"
              alignItems="center"
              justifyContent="center"
              w={compact ? "18px" : "20px"}
              h={compact ? "18px" : "20px"}
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
