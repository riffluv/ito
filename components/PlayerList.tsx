"use client";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { UI_TOKENS } from "@/theme/layout";
import { Avatar, Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { useMemo } from "react";

// 仕様: 48pxの名簿行（コンパクト）と、クリックで拡張（ヒントや詳細）。
// グルーピング: 未入力 / 入力中 / 準備OK（見出しはスティッキー）。
export function PlayerList({
  players,
  online,
  myId,
}: {
  players: (PlayerDoc & { id: string })[];
  online?: string[] | undefined;
  myId?: string | null;
}) {
  // 並び: 未入力 → 入力中 → 準備OK、同カテゴリ内は名前昇順
  const groups = useMemo(() => {
    const norm = players.map((p) => ({
      ...p,
      state: p.ready ? "ready" : p.clue1 ? "typing" : "empty",
    }));
    const by = (state: "empty" | "typing" | "ready") =>
      norm
        .filter((p) => p.state === state)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return {
      empty: by("empty"),
      typing: by("typing"),
      ready: by("ready"),
    };
  }, [
    players.map((p) => `${p.id}:${p.ready ? 1 : 0}:${p.clue1 || ""}`).join(","),
  ]);

  // 連想ワードは常時表示に変更（トグルは廃止）

  const Section = ({
    title,
    list,
  }: {
    title: string;
    list: (PlayerDoc & { id: string })[];
  }) => (
    <>
      <Box
        position="sticky"
        top={0}
        zIndex={1}
        bg={UI_TOKENS.COLORS.panelBg}
        py={2}
        mb={2}
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha80}`}
        borderRadius={0}
        boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
      >
        <Text
          fontSize="xs"
          color="white"
          px={2}
          letterSpacing="0.08em"
          textTransform="uppercase"
          fontWeight="600"
          fontFamily="monospace"
          textShadow="1px 1px 0px #000"
        >
          {title}
        </Text>
      </Box>
      {list.map((p) => {
        const isMe = myId && p.uid ? myId === p.uid : myId === p.id;
        return (
          <Box
            key={p.id}
            p={3}
            borderRadius={0}
            bg={isMe ? UI_TOKENS.COLORS.dqBlue : UI_TOKENS.COLORS.panelBg}
            color="white"
            border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha70}`}
            boxShadow={UI_TOKENS.SHADOWS.buttonRaised}
            _hover={{
              borderColor: UI_TOKENS.COLORS.whiteAlpha90,
              transform: "translateY(-1px)",
              boxShadow: UI_TOKENS.SHADOWS.panelDistinct
            }}
            transition="all 0.15s ease"
          >
            <HStack gap={3} minH="48px" align="center">
              <Avatar.Root size="sm">
                <Avatar.Fallback name={p.name} />
              </Avatar.Root>
              <HStack gap={2} flex={1} minW={0} align="center">
                <Text fontWeight="semibold" lineClamp={1} minW={0} color="white">
                  {p.name}
                </Text>
                {isMe && typeof p.number === "number" && (
                  <Box
                    px={2}
                    py={1}
                    bg={UI_TOKENS.COLORS.dqGold}
                    color="black"
                    border={`1px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
                    borderRadius={0}
                    boxShadow="1px 1px 0px rgba(0,0,0,0.6)"
                    title="あなたの数字"
                  >
                    <Text as="span" fontSize="xs" fontWeight="600" fontFamily="monospace">
                      #{p.number}
                    </Text>
                  </Box>
                )}
              </HStack>
              <HStack>
                {Array.isArray(online) && online.includes(p.id) ? (
                  <Box
                    px={2}
                    py={1}
                    bg={UI_TOKENS.COLORS.dqGreen}
                    color="white"
                    border={`1px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
                    borderRadius={0}
                    boxShadow="1px 1px 0px rgba(0,0,0,0.6)"
                  >
                    <Text fontSize="xs" fontWeight="600" fontFamily="monospace">オンライン</Text>
                  </Box>
                ) : p.ready ? (
                  <Box
                    px={2}
                    py={1}
                    bg={UI_TOKENS.COLORS.dqBlue}
                    color="white"
                    border={`1px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
                    borderRadius={0}
                    boxShadow="1px 1px 0px rgba(0,0,0,0.6)"
                  >
                    <Text fontSize="xs" fontWeight="600" fontFamily="monospace">準備OK</Text>
                  </Box>
                ) : p.clue1 ? (
                  <Box
                    px={2}
                    py={1}
                    bg={UI_TOKENS.COLORS.dqGold}
                    color="black"
                    border={`1px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
                    borderRadius={0}
                    boxShadow="1px 1px 0px rgba(0,0,0,0.6)"
                  >
                    <Text fontSize="xs" fontWeight="600" fontFamily="monospace">入力中</Text>
                  </Box>
                ) : (
                  <Box
                    px={2}
                    py={1}
                    bg={UI_TOKENS.COLORS.blackAlpha60}
                    color={UI_TOKENS.COLORS.whiteAlpha70}
                    border={`1px solid ${UI_TOKENS.COLORS.whiteAlpha50}`}
                    borderRadius={0}
                    boxShadow="1px 1px 0px rgba(0,0,0,0.6)"
                  >
                    <Text fontSize="xs" fontWeight="600" fontFamily="monospace">未入力</Text>
                  </Box>
                )}
              </HStack>
            </HStack>
            <Box
              mt={2}
              pt={2}
              bg={UI_TOKENS.COLORS.blackAlpha40}
              border={`1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`}
              borderRadius={0}
              boxShadow="inset 1px 1px 2px rgba(0,0,0,0.4)"
            >
              <Text
                fontSize="sm"
                color={UI_TOKENS.COLORS.whiteAlpha80}
                lineClamp={3}
                overflowWrap="anywhere"
                title={p.clue1 || "（未設定）"}
                fontFamily="monospace"
              >
                連想ワード: {p.clue1 ? p.clue1 : "（未設定）"}
              </Text>
            </Box>
          </Box>
        );
      })}
    </>
  );

  const total = players.length;
  if (total === 0) {
    return (
      <Text fontSize="sm" color="fgMuted">
        プレイヤーがいません
      </Text>
    );
  }
  return (
    <Stack gap={2}>
      {groups.empty.length > 0 && (
        <Section title="未入力" list={groups.empty} />
      )}
      {groups.typing.length > 0 && (
        <Section title="入力中" list={groups.typing} />
      )}
      {groups.ready.length > 0 && (
        <Section title="準備OK" list={groups.ready} />
      )}
    </Stack>
  );
}
