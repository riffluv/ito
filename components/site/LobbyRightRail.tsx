"use client";
import { AppCard } from "@/components/ui/AppCard";
import { Box, Link, Stack, Text } from "@chakra-ui/react";

export default function LobbyRightRail() {
  return (
    <Box as="aside" position="sticky" top="80px">
      <AppCard>
        <Stack gap={2}>
          <Text fontWeight="bold">はじめての方へ</Text>
          <Text color="fgMuted" fontSize="sm">
            1. 部屋を作成または参加します。2. お題に沿って数字の大小感で並べ替え、全員の認識を合わせましょう。
          </Text>
          <Link href="/" color="link" fontSize="sm">
            ルールを見る
          </Link>
        </Stack>
      </AppCard>

      <AppCard mt={4}>
        <Stack gap={2}>
          <Text fontWeight="bold">アップデート情報</Text>
          <Text color="fgMuted" fontSize="sm">
            UIを刷新し、左右に情報を配置。リストはスクロール領域で快適に閲覧できます。
          </Text>
        </Stack>
      </AppCard>
    </Box>
  );
}

