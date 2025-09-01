"use client";
import { TopicDisplay } from "@/components/TopicDisplay";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";

export default function UniversalMonitor({
  room,
  players,
}: {
  room: RoomDoc | null;
  players: (PlayerDoc & { id: string })[];
}) {
  if (!room) return null;

  return (
    <Box 
      textAlign="center" 
      marginBottom={{ base: "1rem", md: "1.25rem" }}
      css={{ 
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: { 
          marginBottom: "0.75rem" 
        } 
      }}
    >
      {/* 🎯 QUIET LUXURY TOPIC DISPLAY - Sophisticated Minimalism */}
      <Box
        css={{
          // === REFINED TYPOGRAPHY ===
          fontSize: '1.125rem',
          fontWeight: 600,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
          letterSpacing: '-0.02em',
          lineHeight: 1.3,
          
          // === SOPHISTICATED CONTAINER ===
          padding: '16px 24px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          
          // === PREMIUM VISUAL EFFECTS ===
          boxShadow: '0 2px 8px -2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
          backdropFilter: 'blur(8px)',
          
          // === QUIET LUXURY COLOR APPROACH ===
          color: 'rgba(255,255,255,0.92)',
          textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          
          // === SUBTLE INTERACTION ===
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          overflow: 'hidden',
          
          // === UNDERSTATED ACCENT ===
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
            pointerEvents: 'none'
          },
          
          // === RESPONSIVE REFINEMENT ===
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: { 
            fontSize: '1rem',
            padding: '14px 20px'
          },
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: { 
            fontSize: '0.9375rem',
            padding: '12px 18px'
          },
          
          // === SUBTLE HOVER SOPHISTICATION ===
          '&:hover': {
            background: 'rgba(255,255,255,0.04)',
            borderColor: 'rgba(255,255,255,0.08)',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 16px -4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)'
          }
        }}
      >
        <TopicDisplay room={room} inline />
      </Box>
    </Box>
  );
}
