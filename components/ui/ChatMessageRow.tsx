"use client";
import { memo, useMemo } from "react";
import { Box, HStack, Text } from "@chakra-ui/react";
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
          width="24px"
          height="24px"
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
              fontSize="sm"
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
              fontSize="sm"
              fontWeight="bold"
              color={accent}
              textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
              maxW="90px"
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
                fontSize="sm"
                fontFamily="monospace"
                color={UI_TOKENS.COLORS.whiteAlpha80}
                flexShrink={0}
              >
                👑
              </Text>
            )}
            <Text
              fontSize="sm"
              color="rgba(255,255,255,0.4)"
              fontFamily="monospace"
              flexShrink={0}
              mx={1}
            >
              :
            </Text>
            <Text
              fontSize="sm"
              color={UI_TOKENS.COLORS.whiteAlpha90}
              fontFamily="monospace"
              textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
              lineHeight={1.5}
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

// ⚡ PERFORMANCE: カスタム比較関数で不要な再レンダリングを防止
export const ChatMessageRow = memo(ChatMessageRowBase, (prev, next) => {
  // プリミティブ値とオプショナル値の比較
  if (prev.sender !== next.sender) return false;
  if (prev.text !== next.text) return false;
  if (prev.isMe !== next.isMe) return false;
  if (prev.isHost !== next.isHost) return false;
  if (prev.avatar !== next.avatar) return false;
  if (prev.accentColor !== next.accentColor) return false;

  return true; // 全て同じなら再レンダリングしない
});

export default ChatMessageRow;
