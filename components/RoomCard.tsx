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
  const statusLabel = status === "waiting" ? "待機中" : "ゲーム中";
  const isWaiting = status === "waiting";

  return (
    <Box
      role="group"
      position="relative"
      cursor="pointer"
      onClick={onJoin}
      transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      _hover={{
        transform: "translateY(-4px)",
      }}
    >
      {/* Main Card */}
      <Box
        borderRadius="xl"
        border="1px solid rgba(255,255,255,0.1)"
        bg="rgba(255,255,255,0.03)"
        backdropFilter="blur(20px)"
        p={6}
        minH="180px"
        position="relative"
        overflow="hidden"
        boxShadow="0 4px 16px rgba(0,0,0,0.1)"
        _groupHover={{
          border: "1px solid rgba(107,115,255,0.3)",
          bg: "rgba(107,115,255,0.05)",
          boxShadow: "0 8px 32px rgba(107,115,255,0.2)",
          _before: {
            opacity: 1,
          },
        }}
        _before={{
          content: '""',
          position: "absolute",
          inset: 0,
          borderRadius: "xl",
          background:
            "linear-gradient(135deg, rgba(107,115,255,0.08) 0%, rgba(153,69,255,0.04) 100%)",
          opacity: 0,
          transition: "opacity 0.3s ease",
          pointerEvents: "none",
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
              color="white"
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
                <Users size={14} color="rgba(255,255,255,0.6)" />
                <Text fontSize="sm" color="fgMuted" fontWeight={500}>
                  {count}人参加中
                </Text>
              </HStack>

              {isWaiting && (
                <HStack gap={1.5}>
                  <UserCheck size={14} color="rgba(34,197,94,0.8)" />
                  <Text
                    fontSize="sm"
                    color="rgba(34,197,94,0.8)"
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
                    background:
                      "linear-gradient(135deg, #6B73FF 0%, #9945FF 100%)",
                    boxShadow: "0 2px 8px rgba(107,115,255,0.3)",
                    _hover: {
                      transform: "translateY(-1px)",
                      boxShadow: "0 4px 16px rgba(107,115,255,0.4)",
                      background:
                        "linear-gradient(135deg, #8B92FF 0%, #B565FF 100%)",
                    },
                  }
                : {
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
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
          position="absolute"
          top={0}
          left={0}
          right={0}
          h="2px"
          bg="linear-gradient(90deg, #6B73FF, #9945FF)"
          borderTopRadius="20px"
          opacity={0}
          transition="opacity 0.3s ease"
          _groupHover={{
            opacity: 1,
          }}
        />
      </Box>
    </Box>
  );
}
