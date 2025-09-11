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
        color={isMe ? "rgba(255,223,0,0.9)" : "rgba(135,206,250,0.9)"}
        fontFamily="monospace"
        fontWeight="bold"
        textShadow="0 1px 1px rgba(0,0,0,0.6)"
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
        textShadow="0 1px 1px rgba(0,0,0,0.6)"
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
