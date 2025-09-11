"use client";
import { AppButton } from "@/components/ui/AppButton";
import { Badge, Box, HStack, Text, VStack } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { Play, UserCheck, Users } from "lucide-react";

export function RoomCard({
  name,
  status,
  count,
  hostName,
  onJoin,
}: {
  name: string;
  status: string;
  count: number;
  hostName: string;
  onJoin: () => void;
}) {
  const statusLabel = status === "waiting" ? "待機中" : "進行中";
  const isWaiting = status === "waiting";

  return (
    <Box
      role="group"
      position="relative"
      cursor={isWaiting ? "pointer" : "not-allowed"}
      onClick={() => {
        if (!isWaiting) return; // 進行中は無効
        onJoin();
      }}
      aria-disabled={!isWaiting}
      _hover={{}}
      css={{
        "&:hover .hover-decoration": {
          opacity: 1,
        },
      }}
    >
      {/* Main Card */}
      <Box
        borderRadius="xl"
        border="2px solid"
        borderColor="border"
        bg="glassBg05"
        backdropFilter="blur(20px)"
        p={6}
        minH="180px"
        position="relative"
        overflow="hidden"
        boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
        transition="transform 0.18s ease, background 0.2s ease, border-color 0.2s ease"
        willChange="transform"
        _hover={{
          transform: "translateY(-8px)",
          borderColor: "primary",
          bg: "accentSubtle",
        }}
        css={{
          // DPI scaling card optimization
          "@container (max-width: 600px)": {
            padding: "1.25rem", // 20px for mobile - better tap targets
            minHeight: "10rem", // 160px for mobile
          },
          "@container (min-width: 600px) and (max-width: 900px)": {
            padding: "1.375rem", // 22px for tablet
            minHeight: "11rem", // 176px for tablet
          },
          "@container (min-width: 900px)": {
            padding: "1.5rem", // 24px for desktop
            minHeight: "12rem", // 192px for desktop
          }
        }}
      >
        {/* Status indicator */}
        <Box position="absolute" top={4} right={4} zIndex={2}>
          <Badge
            variant={isWaiting ? "subtle" : "solid"}
            colorPalette={isWaiting ? "green" : "orange"}
            borderRadius="full"
            fontSize="xs"
            fontWeight={600}
            px={3}
            py={1}
          >
            {statusLabel}
          </Badge>
        </Box>

        <VStack align="start" gap={4} position="relative" h="100%">
          {/* Header */}
          <Box flex={1} w="100%">
            <VStack align="start" gap={1} mb={3}>
              <Text
                fontSize="xl"
                fontWeight={700}
                color="text"
                lineHeight={1.3}
                letterSpacing="-0.01em"
                css={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {name}
              </Text>
              <Text
                fontSize="xs"
                fontWeight={600}
                lineHeight={1.2}
                color="#FFD700"
                css={{
                  textShadow: UI_TOKENS.TEXT_SHADOWS.heroGold,
                  animation: "hostGlow 2s ease-in-out infinite alternate",
                }}
              >
                👑 ホスト: {hostName}
              </Text>
            </VStack>

            {/* Room stats */}
            <HStack gap={4} opacity={0.8}>
              <HStack gap={1.5}>
                <Users size={14} color="var(--colors-textMuted)" />
                <Text fontSize="sm" color="fgMuted" fontWeight={500}>
                  {count}人オンライン
                </Text>
              </HStack>

              <HStack gap={1.5}>
                <UserCheck
                  size={14}
                  color={
                    isWaiting
                      ? "var(--colors-success)"
                      : "var(--colors-textMuted)"
                  }
                />
                <Text
                  fontSize="sm"
                  color={
                    isWaiting
                      ? "var(--colors-success)"
                      : "var(--colors-textMuted)"
                  }
                  fontWeight={500}
                >
                  {isWaiting ? "参加可能" : "参加不可"}
                </Text>
              </HStack>
            </HStack>
          </Box>

          {/* Join button or status */}
          {isWaiting ? (
            <AppButton
              size="sm"
              visual="solid"
              palette="brand"
              css={{ width: "100%" }}
              onClick={(e) => {
                e.stopPropagation();
                onJoin();
              }}
            >
              <Play size={16} style={{ marginRight: "8px" }} />
              参加する
            </AppButton>
          ) : (
            <Box
              textAlign="center"
              py={3}
              px={4}
              width="100%"
              borderRadius="md"
              bg={UI_TOKENS.COLORS.whiteAlpha02}
              border={`1px solid ${UI_TOKENS.COLORS.whiteAlpha10}`}
              css={{ pointerEvents: "none" }}
            >
              <Text
                fontSize="sm"
                color="fgMuted"
                fontWeight={500}
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={2}
              >
                <Play size={14} />
                ゲーム中
              </Text>
            </Box>
          )}
        </VStack>

        {/* Hover decoration */}
        <Box
          className="hover-decoration"
          position="absolute"
          top={0}
          left={0}
          right={0}
          h="2px"
          bg="accentSubtle"
          borderTopRadius="20px"
          opacity={0}
          transition="opacity 0.3s ease"
        />
      </Box>
    </Box>
  );
}
