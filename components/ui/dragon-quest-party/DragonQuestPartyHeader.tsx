"use client";

import Tooltip from "@/components/ui/Tooltip";
import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { Box, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

const headerPulse = keyframes`
  0% { box-shadow: 0 calc(2px * var(--dpi-scale)) calc(8px * var(--dpi-scale)) rgba(0,0,0,0.6), inset 0 calc(1px * var(--dpi-scale)) 0 rgba(255,255,255,0.08); }
  40% { box-shadow: 0 calc(3px * var(--dpi-scale)) calc(9px * var(--dpi-scale)) rgba(0,0,0,0.7), inset 0 calc(1px * var(--dpi-scale)) 0 rgba(255,255,255,0.12); }
  100% { box-shadow: 0 calc(2px * var(--dpi-scale)) calc(8px * var(--dpi-scale)) rgba(0,0,0,0.6), inset 0 calc(1px * var(--dpi-scale)) 0 rgba(255,255,255,0.08); }
`;

const headerGlint = keyframes`
  0% { transform: translateX(-140%) rotate(9deg); opacity: 0; }
  12% { transform: translateX(20%) rotate(9deg); opacity: 0.35; }
  18% { transform: translateX(80%) rotate(9deg); opacity: 0.12; }
  28% { transform: translateX(140%) rotate(9deg); opacity: 0; }
  100% { transform: translateX(140%) rotate(9deg); opacity: 0; }
`;

type DragonQuestPartyHeaderProps = {
  displayRoomName?: string;
  actualCount: number;
  prefersReducedMotion: boolean;
  headerGlowShift: string;
  headerGlowOpacity: number;
};

export function DragonQuestPartyHeader({
  displayRoomName,
  actualCount,
  prefersReducedMotion,
  headerGlowShift,
  headerGlowOpacity,
}: DragonQuestPartyHeaderProps) {
  return (
    <Box
      display="flex"
      alignItems="center"
      gap={scaleForDpi("8px")}
      minW={0}
      px={scaleForDpi("14px")}
      py={scaleForDpi("8px")}
      bg="rgba(12,14,20,0.45)"
      border="1px solid"
      borderColor="rgba(255,255,255,0.12)"
      borderRadius="0"
      boxShadow={`0 ${scaleForDpi("2px")} ${scaleForDpi("6px")} rgba(0,0,0,0.15)`}
      css={{
        pointerEvents: "auto",
        backdropFilter: "blur(16px) saturate(1.25)",
        position: "relative",
        overflow: "visible",
        clipPath: `polygon(${scaleForDpi("12px")} 0%, calc(100% - ${scaleForDpi("12px")}) 0%, 100% ${scaleForDpi("12px")}, 100% 100%, 0% 100%, 0% ${scaleForDpi("12px")})`,
        ...(prefersReducedMotion
          ? {
              transition: "box-shadow 1.2s ease-in-out, filter 1.2s ease-in-out",
            }
          : {
              animation: `${headerPulse} 9.8s ease-in-out infinite`,
            }),
        "&::after": {
          content: "''",
          position: "absolute",
          inset: "-40%",
          background:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 60%)",
          transform: headerGlowShift,
          ...(prefersReducedMotion
            ? {
                transition: "opacity 1.2s ease-in-out, transform 1.2s ease-in-out",
              }
            : {
                animation: `${headerGlint} 6.2s cubic-bezier(0.16, 0.84, 0.33, 1) infinite`,
              }),
          pointerEvents: "none",
          mixBlendMode: "screen",
          opacity: headerGlowOpacity,
        },
      }}
    >
      {/* フラッグエンブレム */}
      <Box
        position="relative"
        w={scaleForDpi("24px")}
        h={scaleForDpi("24px")}
        flexShrink={0}
        css={{
          filter: `drop-shadow(0 ${scaleForDpi("1px")} ${scaleForDpi("3px")} rgba(0,0,0,0.8))`,
        }}
      >
        <img
          src="/images/flag.webp"
          alt="party emblem"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </Box>

      {/* パーティ名 */}
      <Tooltip content={displayRoomName || ""} openDelay={300} disabled={!displayRoomName}>
        <Text
          fontSize={scaleForDpi("14px")}
          fontWeight={600}
          color="rgba(255,255,255,0.95)"
          letterSpacing="0.3px"
          maxW={scaleForDpi("160px")}
          truncate
          textShadow={`0 ${scaleForDpi("1px")} ${scaleForDpi("2px")} rgba(0,0,0,0.6)`}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {displayRoomName && displayRoomName.trim().length > 0 ? displayRoomName : "なかま"}
        </Text>
      </Tooltip>

      {/* 人数表示 */}
      <Text
        fontSize={scaleForDpi("12px")}
        color="rgba(255,255,255,0.65)"
        fontWeight={500}
        flexShrink={0}
        fontFamily="monospace"
        letterSpacing="0.5px"
        lineHeight="1"
        alignSelf="center"
      >
        ({actualCount})
      </Text>
    </Box>
  );
}

