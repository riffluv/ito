"use client";
import { AppCard } from "@/components/ui/AppCard";
import { Box, HStack, Stack } from "@chakra-ui/react";

function Line({ w = "60%", h = 4 }: { w?: any; h?: any }) {
  return (
    <Box
      w={w}
      h={h}
      rounded="full"
      bg="blackAlpha.300"
      _dark={{ bg: "whiteAlpha.200" }}
      className="animate-pulse"
    />
  );
}

export function RoomCardSkeleton() {
  return (
    <AppCard>
      <Stack gap={3}>
        <Line w="50%" h={5} />
        <HStack justify="space-between">
          <Line w="30%" h={3} />
          <Line w="20%" h={3} />
        </HStack>
        <Line w="25%" h={9} />
      </Stack>
    </AppCard>
  );
}

export default function LobbySkeletons() {
  return (
    <Stack gap={4}>
      {Array.from({ length: 6 }).map((_, i) => (
        <RoomCardSkeleton key={i} />
      ))}
    </Stack>
  );
}

