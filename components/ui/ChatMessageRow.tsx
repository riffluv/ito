"use client";
import { memo } from "react";
import { HStack, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";

export interface ChatMessageRowProps {
  sender: string;
  text: string;
  isMe?: boolean;
}

function ChatMessageRowBase({ sender, text, isMe }: ChatMessageRowProps) {
  return (
    <HStack gap={2} align="flex-start" flexWrap="nowrap">
      <Text
        fontSize="sm"
        color={isMe ? UI_TOKENS.COLORS.accentGold : UI_TOKENS.COLORS.skyBlue}
        fontFamily="monospace"
        fontWeight="bold"
        textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
        minW="100px"
        maxW="100px"
        textAlign="left"
        flexShrink={0}
        title={sender}
        whiteSpace="nowrap"
        overflow="hidden"
        css={{ textOverflow: "ellipsis" }}
      >
        {sender}
      </Text>
      <Text
        fontSize="sm"
        color={UI_TOKENS.COLORS.textBase}
        fontFamily="monospace"
        textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
        lineHeight={1.4}
        flex={1}
        wordBreak="break-word"
      >
        {text}
      </Text>
    </HStack>
  );
}

export const ChatMessageRow = memo(ChatMessageRowBase);

export default ChatMessageRow;
