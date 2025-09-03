"use client";
import { Box, Grid } from "@chakra-ui/react";

function RoomCardSkeleton() {
  return (
    <Box
      borderRadius="20px"
      border="1px solid rgba(255,255,255,0.1)"
      bg="rgba(255,255,255,0.03)"
      backdropFilter="blur(20px)"
      p={6}
      minH="180px"
      position="relative"
      overflow="hidden"
      css={{
        animation: "pulse 2s infinite",
        "@keyframes pulse": {
          "0%, 100%": { opacity: 0.4 },
          "50%": { opacity: 0.6 },
        },
      }}
    >
      {/* Status badge skeleton */}
      <Box
        position="absolute"
        top={4}
        right={4}
        w="60px"
        h="24px"
        borderRadius="full"
        bg="rgba(255,255,255,0.1)"
      />

      {/* Title skeleton */}
      <Box
        w="70%"
        h="20px"
        borderRadius="8px"
        bg="rgba(255,255,255,0.15)"
        mb={4}
      />

      {/* Stats skeleton */}
      <Box
        w="40%"
        h="14px"
        borderRadius="6px"
        bg="rgba(255,255,255,0.1)"
        mb={6}
      />

      {/* Button skeleton */}
      <Box
        position="absolute"
        bottom={6}
        left={6}
        right={6}
        h="40px"
        borderRadius="12px"
        bg="rgba(107,115,255,0.2)"
      />
    </Box>
  );
}

export default function LobbySkeletons() {
  return (
    <Grid
      templateColumns={{
        base: "1fr",
        md: "repeat(2, 1fr)",
        lg: "repeat(3, 1fr)",
      }}
      gap={6}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <RoomCardSkeleton key={i} />
      ))}
    </Grid>
  );
}
