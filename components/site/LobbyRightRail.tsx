"use client";
import { Box, Link, Stack, Text, HStack } from "@chakra-ui/react";

export default function LobbyRightRail() {
  return (
    <Box as="aside" position="sticky" top="80px">
      {/* 🎯 PREMIUM HELP CARD */}
      <Box
        css={{
          background: 'rgba(25,27,33,0.6)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          padding: '20px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 4px 12px -2px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
          position: 'relative',
          
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.04) 100%)',
            pointerEvents: 'none'
          }
        }}
      >
        <Stack gap={4} position="relative">
          <HStack gap={3} align="center">
            <Box 
              w={8} h={8}
              bg="linear-gradient(135deg, #22C55E 0%, #16A34A 100%)"
              borderRadius="10px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              boxShadow="0 3px 10px rgba(34,197,94,0.3)"
            >
              <Box 
                w="40%" h="40%"
                bg="white"
                borderRadius="4px"
              />
            </Box>
            <Text 
              css={{
                fontWeight: 700,
                fontSize: '1rem',
                color: 'rgba(255,255,255,0.95)',
                letterSpacing: '-0.02em'
              }}
            >
              はじめての方へ
            </Text>
          </HStack>
          
          <Text 
            css={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              fontWeight: 400
            }}
          >
            1. 部屋を作成または参加します<br />
            2. お題に沿って数字の大小感で並べ替え<br />
            3. 全員の認識を合わせましょう
          </Text>
          
          <Link 
            href="/rules" 
            css={{
              color: '#8B92FF',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'color 0.2s ease',
              '&:hover': {
                color: '#A5ABFF',
                textDecoration: 'underline'
              }
            }}
          >
            ルールを詳しく見る →
          </Link>
        </Stack>
      </Box>

      {/* 🎯 PREMIUM UPDATE CARD */}
      <Box
        mt={5}
        css={{
          background: 'rgba(25,27,33,0.6)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          padding: '20px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 4px 12px -2px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
          position: 'relative',
          
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.04) 100%)',
            pointerEvents: 'none'
          }
        }}
      >
        <Stack gap={4} position="relative">
          <HStack gap={3} align="center">
            <Box 
              w={8} h={8}
              bg="linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)"
              borderRadius="10px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              boxShadow="0 3px 10px rgba(99,102,241,0.3)"
            >
              <Box 
                w="40%" h="40%"
                bg="white"
                borderRadius="4px"
              />
            </Box>
            <Text 
              css={{
                fontWeight: 700,
                fontSize: '1rem',
                color: 'rgba(255,255,255,0.95)',
                letterSpacing: '-0.02em'
              }}
            >
              アップデート情報
            </Text>
          </HStack>
          
          <Text 
            css={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              fontWeight: 400
            }}
          >
            UIを一流デザイナーレベルに完全刷新。<br />
            Chakra UI公式サイト品質のプレミアムデザインを実現しました。
          </Text>
          
          <Box 
            css={{
              padding: '8px 12px',
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: '8px',
              fontSize: '0.75rem',
              color: '#C7CBFF',
              fontWeight: 500,
              textAlign: 'center'
            }}
          >
            v2.0 - Premium Experience ✨
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

