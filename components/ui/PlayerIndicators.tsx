"use client";
import type { PlayerDoc } from "@/lib/types";
import { Box, Text } from "@chakra-ui/react";

export default function PlayerIndicators({
  players,
  onlineCount,
}: {
  players: (PlayerDoc & { id: string })[];
  onlineCount: number;
}) {
  const total = players.length;
  const submitted = players.filter(
    (p) => !!p?.clue1 && String(p.clue1).trim() !== ""
  ).length;

  const Card = ({ pos }: { pos: "left" | "right" }) => (
    <Box
      className={`player-indicator ${pos === "left" ? "top-left" : "top-right"}`}
      position="fixed"
      top={{ base: "84px", md: "100px" }}
      left={pos === "left" ? { base: 3, md: 6 } : undefined}
      right={pos === "right" ? { base: 3, md: 6 } : undefined}
      zIndex={15}
      rounded="lg"
      px={4}
      py={3}
      minW={{ base: "170px", md: "200px" }}
      bg="surfaceOverlay"
      borderWidth="1px"
      borderColor="borderDefault"
      shadow="md"
      display="flex"
      flexDirection="column"
      gap={1}
      transition="background-color .25s, border-color .25s, box-shadow .25s, transform .25s"
      _hover={{ transform: "translateY(-2px)", shadow: "lg" }}
    >
      {pos === "left" ? (
        <>
          <Text
            fontSize="11px"
            color="fgMuted"
            fontWeight={600}
            letterSpacing="0.5px"
            textTransform="uppercase"
          >
            提出状況
          </Text>
          <Text color="accent" fontWeight={700} fontSize="14px">
            {submitted}/{total} 提出
          </Text>
        </>
      ) : (
        <>
          <Text
            fontSize="11px"
            color="fgMuted"
            fontWeight={600}
            letterSpacing="0.5px"
            textTransform="uppercase"
          >
            プレイヤー
          </Text>
          <Text color="accent" fontWeight={700} fontSize="14px">
            {onlineCount}/{total} 接続中
          </Text>
        </>
      )}
    </Box>
  );

  return (
    <>
      <Card pos="left" />
      <Card pos="right" />
    </>
  );
}
