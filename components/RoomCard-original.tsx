"use client";
import { AppCard } from "@/components/ui/AppCard";
import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";

export function RoomCard({
  name,
  status,
  count,
  onJoin,
}: {
  name: string;
  status: string;
  count: number;
  onJoin: () => void;
}) {
  const statusLabel = status === "waiting" ? "待機中" : "ゲーム中";
  const isWaiting = status === "waiting";
  
  return (
    <Box
      role="group" 
      position="relative"
      css={{
        // 🎯 PREMIUM ROOM CARD DESIGN - Chakra Official Quality
        background: 'rgba(25,27,33,0.6)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '16px',
        padding: '20px',
        minHeight: '180px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 4px 12px -2px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform, box-shadow, border-color',

        '&:hover': {
          background: 'rgba(31,35,44,0.8)',
          borderColor: 'rgba(99,102,241,0.3)',
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px -4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)'
        }
      }}
    >
      {/* 🎯 PREMIUM STATUS INDICATOR */}
      <Box
        position="absolute"
        top="16px"
        right="16px"
        css={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: isWaiting ? 
            'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' : 
            'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
          boxShadow: isWaiting ?
            '0 0 8px rgba(34,197,94,0.6)' :
            '0 0 8px rgba(239,68,68,0.6)',
          animation: isWaiting ? 'pulse 2s ease-in-out infinite' : undefined
        }}
      />
      
      <Stack gap={5}>
        {/* 🎯 PREMIUM ROOM TITLE */}
        <Box>
          <Text
            css={{
              fontWeight: 700,
              fontSize: '1.25rem',
              color: 'rgba(255,255,255,0.95)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
              letterSpacing: '-0.02em',
              lineHeight: 1.3,
              marginBottom: '8px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)'
            }}
          >
            {name}
          </Text>
          <Text
            css={{
              fontSize: '0.875rem',
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 500
            }}
          >
            {statusLabel}
          </Text>
        </Box>

        {/* 🎯 PREMIUM STATISTICS DISPLAY */}
        <Box 
          css={{
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: '12px',
            padding: '16px',
            backdropFilter: 'blur(4px)'
          }}
        >
          <HStack justify="space-between" align="center">
            <Box>
              <Text 
                css={{
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 500,
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                参加者数
              </Text>
              <Text 
                css={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.95)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                {count}人
              </Text>
            </Box>
            <Box textAlign="right">
              <Text 
                css={{
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 500,
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                状態
              </Text>
              <Text 
                css={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: isWaiting ? '#BBF7D0' : '#FECACA'
                }}
              >
                {isWaiting ? "募集中" : "開始済"}
              </Text>
            </Box>
          </HStack>
        </Box>

        {/* 🎯 PREMIUM ACTION BUTTON */}
        <AppButton
          palette={isWaiting ? "brand" : "gray"}
          visual={isWaiting ? "solid" : "surface"}
          size="md"
          onClick={onJoin}
          aria-label={`${name}に参加`}
          disabled={!isWaiting}
          css={{
            width: '100%',
            height: '44px',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '0.875rem',
            background: isWaiting ? 
              'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' : 
              'rgba(107,114,128,0.3)',
            boxShadow: isWaiting ? 
              '0 4px 16px rgba(99,102,241,0.4)' : 
              'none',
            '&:hover:not(:disabled)': {
              transform: 'translateY(-1px)',
              boxShadow: isWaiting ? 
                '0 6px 20px rgba(99,102,241,0.5)' : 
                '0 2px 8px rgba(107,114,128,0.3)'
            },
            '&:disabled': {
              opacity: 0.6,
              cursor: 'not-allowed'
            }
          }}
        >
          {isWaiting ? "参加する" : "開始済み"}
        </AppButton>
      </Stack>
    </Box>
  );
}
