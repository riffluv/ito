"use client";

import { MODAL_HEADER_PADDING } from "@/components/create-room-modal/constants";
import { UI_TOKENS } from "@/theme/layout";
import { Box, Dialog, Text, VStack } from "@chakra-ui/react";

export function CreateRoomModalHeader({ isSuccess }: { isSuccess: boolean }) {
  return (
    <Box
      p={MODAL_HEADER_PADDING}
      position="relative"
      zIndex={20}
      css={{
        borderBottom: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
      }}
    >
      <VStack gap={2} align="center">
        <Dialog.Title
          css={{
            fontSize: "1.5rem",
            fontWeight: "bold",
            color: "white",
            margin: 0,
            textAlign: "center",
            // NameDialogと同じ通常フォント（monospace削除）
          }}
        >
          {isSuccess ? "へやが できました！" : "へやを つくる"}
        </Dialog.Title>
        <Text
          fontSize="sm"
          color="white"
          fontWeight="normal"
          textAlign="center"
          fontFamily="monospace"
          textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
        >
          {isSuccess
            ? "なかまを さそって いざ ぼうけんへ"
            : "あたらしい ぼうけんの はじまり"}
        </Text>
      </VStack>
    </Box>
  );
}

