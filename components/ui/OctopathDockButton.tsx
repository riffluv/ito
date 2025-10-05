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
  0% { transform: translateX(-40%) rotate(11deg); opacity: 0.24; }
  7% { transform: translateX(-35%) rotate(11deg); opacity: 0.31; }
  32% { transform: translateX(22%) rotate(11deg); opacity: 0.48; }
  58% { transform: translateX(68%) rotate(11deg); opacity: 0.29; }
  71% { transform: translateX(85%) rotate(11deg); opacity: 0.35; }
  100% { transform: translateX(120%) rotate(11deg); opacity: 0.19; }
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
        background="linear-gradient(133deg, rgba(22,26,44,0.94) 0%, rgba(18,22,38,0.98) 52%, rgba(14,17,31,0.96) 100%)"
        border="2px solid rgba(208, 176, 118, 0.29)"
        color="rgba(245, 242, 228, 0.91)"
        textShadow="0 1.5px 3px rgba(0,0,0,0.82), 1px 0 0 rgba(0,0,0,0.15)"
        boxShadow="0 11px 23px rgba(0,0,0,0.52), 0 3px 7px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.22)"
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
          transform: finalDisabled ? undefined : "translateY(-1.5px)",
          boxShadow: finalDisabled
            ? undefined
            : "0 14px 29px rgba(0,0,0,0.58), 0 5px 9px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.11)",
          borderColor: finalDisabled ? undefined : "rgba(232, 200, 144, 0.41)",
        }}
        _active={{
          transform: "translateY(2px) scale(0.98)",
          boxShadow: "0 3px 8px rgba(0,0,0,0.62), 0 1px 2px rgba(0,0,0,0.48), inset 0 2px 4px rgba(0,0,0,0.35), inset 0 -1px 0 rgba(255,255,255,0.02)",
        }}
        _focusVisible={{
          outline: "none",
          boxShadow: "0 0 0 2px rgba(128, 186, 255, 0.45), 0 0 0 4px rgba(20, 40, 92, 0.5)",
        }}
        _before={{
          content: "''",
          position: "absolute",
          inset: "-58% -22%",
          background:
            "radial-gradient(ellipse at 48% 52%, rgba(255, 255, 255, 0.19), rgba(115, 155, 248, 0.07) 43%, transparent 68%)",
          transform: "translateX(-40%) rotate(11deg)",
          opacity: 0.38,
          mixBlendMode: "screen",
          pointerEvents: "none",
          animation: `${dockGlint} 7.3s ease-in-out infinite`,
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
