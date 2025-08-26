"use client";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
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
        bg={UNIFIED_LAYOUT.SURFACE.PANEL_SUBTLE}
        py={1}
        mb={1}
      >
        <Text
          fontSize="xs"
          color="fgMuted"
          px={1}
          letterSpacing="0.08em"
          textTransform="uppercase"
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
            borderRadius="xl"
            bg={isMe ? "#141C2E" : "panelSubBg"}
            boxShadow={UNIFIED_LAYOUT.ELEVATION.CARD.RAISED}
            _hover={{ boxShadow: UNIFIED_LAYOUT.ELEVATION.CARD.FLOATING }}
          >
            <HStack gap={3} minH="48px" align="center">
              <Avatar.Root size="sm">
                <Avatar.Fallback name={p.name} />
              </Avatar.Root>
              <HStack gap={2} flex={1} minW={0} align="center">
                <Text fontWeight="semibold" lineClamp={1} minW={0}>
                  {p.name}
                </Text>
                {isMe && typeof p.number === "number" && (
                  <Badge colorPalette="green" title="あなたの数字">
                    <Text as="span" textStyle="numeric">
                      #{p.number}
                    </Text>
                  </Badge>
                )}
              </HStack>
              <HStack>
                {Array.isArray(online) && online.includes(p.id) ? (
                  <Badge colorPalette="green">オンライン</Badge>
                ) : p.ready ? (
                  <Badge colorPalette="green">準備OK</Badge>
                ) : p.clue1 ? (
                  <Badge colorPalette="orange">入力中</Badge>
                ) : (
                  <Badge colorPalette="gray">未入力</Badge>
                )}
              </HStack>
            </HStack>
            <Box
              mt={2}
              pt={2}
              bg={UNIFIED_LAYOUT.SURFACE.PANEL_SUBTLE}
              borderRadius="md"
            >
              <Text
                fontSize="sm"
                color="fgMuted"
                lineClamp={3}
                overflowWrap="anywhere"
                title={p.clue1 || "（未設定）"}
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
