"use client";
import { AppButton } from "@/components/ui/AppButton";
import { Badge, Box, HStack, Text, VStack } from "@chakra-ui/react";
import { Play, UserCheck, Users } from "lucide-react";

export function RoomCard({
  name,
  status,
  count,
  onJoin,
}: {
  name: string;
  status: string;
  count: number;
  onJoin: () => void;
}) {
  const statusLabel = status === "waiting" ? "待機中" : "進行中";
  const isWaiting = status === "waiting";

  return (
    <Box
        role="group"
        position="relative"
        cursor="pointer"
        onClick={onJoin}
        _hover={{}}
        sx={{
          '&:hover .hover-decoration': {
            opacity: 1,
          }
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
          boxShadow="inset 0 2px 0 rgba(255,255,255,0.06), inset 0 -2px 0 rgba(0,0,0,0.30), 0 2px 0 rgba(0,0,0,0.15)"
          transition="transform 0.18s ease, background 0.2s ease, border-color 0.2s ease"
          willChange="transform"
          _hover={{
            transform: "translateY(-8px)",
            borderColor: "primary", 
            bg: "accentSubtle",
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
            <Text
              fontSize="xl"
              fontWeight={700}
              color="text"
              lineHeight={1.3}
              mb={3}
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

            {/* Room stats */}
            <HStack gap={4} opacity={0.8}>
              <HStack gap={1.5}>
                <Users size={14} color="var(--colors-textMuted)" />
                <Text fontSize="sm" color="fgMuted" fontWeight={500}>
                  {count}人オンライン
                </Text>
              </HStack>

              {isWaiting && (
                <HStack gap={1.5}>
                  <UserCheck size={14} color="var(--colors-success)" />
                  <Text
                    fontSize="sm"
                    color="var(--colors-success)"
                    fontWeight={500}
                  >
                    参加可能
                  </Text>
                </HStack>
              )}
            </HStack>
          </Box>

          {/* Join button */}
          <AppButton
            size="sm"
            visual={isWaiting ? "solid" : "ghost"}
            palette={isWaiting ? "brand" : "gray"}
            disabled={!isWaiting}
            css={{
              width: "100%",
              borderRadius: "lg",
              fontWeight: 600,
              ...(isWaiting
                ? {
                    _hover: { transform: "translateY(-1px)" },
                  }
                : {
                    background: "glassBg05",
                    border: "1px solid",
                    borderColor: "border",
                    color: "fgMuted",
                    cursor: "not-allowed",
                  }),
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (isWaiting) onJoin();
            }}
          >
            <Play size={16} style={{ marginRight: "8px" }} />
            {isWaiting ? "参加する" : "ゲーム中"}
          </AppButton>
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


