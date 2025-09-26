"use client";

import { UI_TOKENS } from "@/theme/layout";
import { Box, Button, HStack, Text } from "@chakra-ui/react";

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  disablePrev?: boolean;
  disableNext?: boolean;
};

export function Pagination({
  currentPage,
  totalPages,
  onPrev,
  onNext,
  disablePrev,
  disableNext,
}: PaginationProps) {
  const safeTotal = totalPages > 0 ? totalPages : 1;
  const displayPage = Math.min(Math.max(currentPage + 1, 1), safeTotal);

  return (
    <Box
      border="3px solid rgba(255,255,255,0.9)"
      borderRadius={0}
      bg={UI_TOKENS.COLORS.panelBg}
      boxShadow="2px 2px 0 rgba(0,0,0,0.85)"
      px={{ base: 4, md: 6 }}
      py={{ base: 3, md: 4 }}
    >
      <HStack justify="space-between" align="center" gap={4}>
        <Button
          onClick={onPrev}
          disabled={disablePrev}
          variant="ghost"
          borderRadius={0}
          border="2px solid rgba(255,255,255,0.8)"
          bg={disablePrev ? "whiteAlpha.200" : UI_TOKENS.COLORS.panelBg}
          color="white"
          fontFamily="monospace"
          fontWeight={700}
          px={5}
          py={2}
          _hover={{ bg: disablePrev ? "whiteAlpha.200" : "whiteAlpha.300" }}
          _active={{ bg: "white", color: "black" }}
        >
          まえへ
        </Button>
        <Text
          fontFamily="monospace"
          fontSize="md"
          fontWeight={700}
          color="white"
          textShadow="1px 1px 0 rgba(0,0,0,0.6)"
        >
          {displayPage} / {safeTotal} ページ
        </Text>
        <Button
          onClick={onNext}
          disabled={disableNext}
          variant="ghost"
          borderRadius={0}
          border="2px solid rgba(255,255,255,0.8)"
          bg={disableNext ? "whiteAlpha.200" : UI_TOKENS.COLORS.panelBg}
          color="white"
          fontFamily="monospace"
          fontWeight={700}
          px={5}
          py={2}
          _hover={{ bg: disableNext ? "whiteAlpha.200" : "whiteAlpha.300" }}
          _active={{ bg: "white", color: "black" }}
        >
          つぎへ
        </Button>
      </HStack>
    </Box>
  );
}

