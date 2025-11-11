"use client";

import { UI_TOKENS } from "@/theme/layout";
import { Box, HStack, Input } from "@chakra-ui/react";
import { Search } from "lucide-react";
import type { ChangeEvent } from "react";

export type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  ariaLabel?: string;
};

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = "部屋を さがす...",
  ariaLabel = "ロビーを検索",
}: SearchBarProps) {
  const showClear = value.trim().length > 0;
  const focusTextShadow = UI_TOKENS.TEXT_SHADOWS.soft ?? "1px 1px 0px #000";

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <Box
      border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
      borderRadius={0}
      bg={UI_TOKENS.COLORS.panelBg}
      boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
      px={4}
      py={3}
      position="relative"
    >
      <HStack gap={3} align="center">
        {/* 検索アイコン */}
        <Box color="whiteAlpha.80" display="flex" alignItems="center">
          <Search size={18} />
        </Box>

        <Input
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          fontFamily="monospace"
          fontSize="md"
          fontWeight="normal"
          color="white"
          textShadow="1px 1px 0px #000"
          border="none"
          bg="transparent"
          _placeholder={{
            color: "whiteAlpha.70",
            fontFamily: "monospace",
            textShadow: "1px 1px 0px #000"
          }}
          _focusVisible={{
            outline: "none",
            textShadow: focusTextShadow,
            bg: "whiteAlpha.50"
          }}
        />

        {showClear && (
          <Box
            as="button"
            aria-label="検索条件をクリア"
            onClick={() => {
              onClear?.();
              onChange("");
            }}
            color="white"
            fontFamily="monospace"
            fontSize="lg"
            fontWeight="bold"
            textShadow="1px 1px 0px #000"
            cursor="pointer"
            p={1}
            borderRadius={0}
            transition="all 0.1s ease"
            _hover={{
              bg: "white",
              color: UI_TOKENS.COLORS.panelBg,
              textShadow: "none"
            }}
          >
            ✕
          </Box>
        )}
      </HStack>
    </Box>
  );
}
