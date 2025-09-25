"use client";

import { UI_TOKENS } from "@/theme/layout";
import { Box, HStack, IconButton, Input } from "@chakra-ui/react";
import { Search, X } from "lucide-react";

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

  return (
    <Box
      border="3px solid rgba(255,255,255,0.9)"
      borderRadius={0}
      bg={UI_TOKENS.COLORS.panelBg}
      boxShadow="2px 2px 0 rgba(0,0,0,0.8)"
      px={{ base: 3, md: 4 }}
      py={2}
    >
      <HStack spacing={3} align="center">
        <Box color="whiteAlpha.80" display="flex" alignItems="center">
          <Search size={18} />
        </Box>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          variant="unstyled"
          fontFamily="monospace"
          fontSize="md"
          color="white"
          _placeholder={{ color: "whiteAlpha.70" }}
          _focusVisible={{ outline: "none", textShadow: UI_TOKENS.TEXT_SHADOWS.soft as any }}
        />
        {showClear ? (
          <IconButton
            aria-label="検索条件をクリア"
            icon={<X size={16} />}
            size="sm"
            variant="ghost"
            borderRadius={0}
            onClick={() => {
              onClear?.();
              onChange("");
            }}
            _hover={{ bg: "whiteAlpha.300" }}
            _active={{ bg: "whiteAlpha.400" }}
            color="white"
          />
        ) : null}
      </HStack>
    </Box>
  );
}
