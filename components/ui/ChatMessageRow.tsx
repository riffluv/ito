"use client";
import { memo, useMemo } from "react";
import { Badge, Box, HStack, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";

export interface ChatMessageRowProps {
  sender: string;
  text: string;
  isMe?: boolean;
  isHost?: boolean;
  avatar?: string | null;
  accentColor?: string;
}

function isImageSource(src?: string | null) {
  if (!src) return false;
  return src.startsWith("/") || src.startsWith("http");
}

function ChatMessageRowBase({
  sender,
  text,
  isMe,
  isHost,
  avatar,
  accentColor,
}: ChatMessageRowProps) {
  const accent =
    accentColor || (isHost ? UI_TOKENS.COLORS.accentGold : UI_TOKENS.COLORS.skyBlue);
  const resolvedAvatar = useMemo(() => {
    if (!avatar || avatar.trim().length === 0) return null;
    return avatar.trim();
  }, [avatar]);

  const avatarIsImage = isImageSource(resolvedAvatar || undefined);
  const fallbackAvatar = "◆";

  return (
    <Box
      position="relative"
      borderRadius={0}
      bg="rgba(12, 14, 24, 0.7)"
      border="1px solid rgba(255,255,255,0.1)"
      px={2}
      py={1}
      _hover={{
        bg: "rgba(12, 14, 24, 0.9)",
        borderColor: "rgba(255,255,255,0.2)"
      }}
      transition="all 0.15s ease"
    >
      <HStack align="center" gap={2} flexWrap="nowrap">
        <Box
          borderRadius={0}
          width="20px"
          height="20px"
          flexShrink={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="rgba(8,9,15,0.9)"
          overflow="hidden"
        >
          {avatarIsImage ? (
            <Box
              width="100%"
              height="100%"
              backgroundImage={`url(${resolvedAvatar})`}
              backgroundSize="cover"
              backgroundPosition="center"
            />
          ) : (
            <Text
              fontFamily="monospace"
              fontSize="xs"
              color={accent}
              textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
            >
              {resolvedAvatar || fallbackAvatar}
            </Text>
          )}
        </Box>

        <Box flex={1} minW={0}>
          <HStack gap={1} align="center" flexWrap="nowrap">
            <Text
              fontFamily="monospace"
              fontSize="xs"
              fontWeight="bold"
              color={accent}
              textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
              maxW="80px"
              overflow="hidden"
              whiteSpace="nowrap"
              title={sender}
              css={{ textOverflow: "ellipsis" }}
              flexShrink={0}
            >
              {sender}
            </Text>
            {isHost && (
              <Text
                fontSize="xs"
                fontFamily="monospace"
                color={UI_TOKENS.COLORS.whiteAlpha80}
                flexShrink={0}
              >
                👑
              </Text>
            )}
            <Text
              fontSize="xs"
              color="rgba(255,255,255,0.4)"
              fontFamily="monospace"
              flexShrink={0}
              mx={1}
            >
              :
            </Text>
            <Text
              fontSize="xs"
              color={UI_TOKENS.COLORS.whiteAlpha90}
              fontFamily="monospace"
              textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
              lineHeight={1.4}
              whiteSpace="pre-wrap"
              wordBreak="break-word"
              flex={1}
            >
              {text}
            </Text>
          </HStack>
        </Box>
      </HStack>
    </Box>
  );
}

export const ChatMessageRow = memo(ChatMessageRowBase);

export default ChatMessageRow;
