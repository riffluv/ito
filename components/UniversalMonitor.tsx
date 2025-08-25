"use client";
import { TopicDisplay } from "@/components/TopicDisplay";
import { Panel } from "@/components/ui/Panel";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";

export default function UniversalMonitor({
  room,
  players,
}: {
  room: RoomDoc | null;
  players: (PlayerDoc & { id: string })[];
}) {
  if (!room) return null;

  return (
    <Panel
      minH={
        UNIFIED_LAYOUT.MONITOR_MIN_HEIGHT
      } /* コンパクト化：統一システム対応 */
      display="flex"
      flexDir="column"
      justifyContent="flex-start"
      density="compact"
      p={4} /* 統一スペーシング：UNIFIED_LAYOUT.SPACING.COMPONENT_PADDING相当 */
      overflow="hidden"
    >
      {/* top banner */}
      <Box
        bgGradient="linear(90deg,#ff9a58,#ffcf67)"
        px={4}
        py={2}
        roundedTopLeft={8}
        roundedTopRight={8}
        color="panelBannerFg"
        fontWeight={700}
        fontSize="sm"
      >
        ラウンド {room?.round ?? 1} | カテゴリ:{" "}
        {(room as any)?.topicBox ?? "未選択"}
      </Box>

      {/* 
        固定高さエリア - CLS防止のため高さ変動を完全に排除
        成功/失敗演出はCentralCardBoard内で統合的に実装
      */}
      <Box
        px={5}
        py={3}
        textAlign="center"
        h="120px" // minH → h に変更で固定高さ化
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Box w="full">
          <TopicDisplay room={room} inline />
        </Box>
      </Box>
    </Panel>
  );
}
