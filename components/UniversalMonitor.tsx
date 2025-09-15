"use client";
import { TopicDisplay } from "@/components/TopicDisplay";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
import { Box, Text } from "@chakra-ui/react";

// ドラクエ風フェーズアナウンス
const getPhaseAnnouncement = (status: string) => {
  switch (status) {
    case "waiting":
      return "▼ ゲーム準備中 ▼";
    case "clue": 
      return "▼ 連想ワードを考えよう ▼";
    case "playing":
      return "▼ 順番に並べよう ▼";
    case "finished":
      return "▼ 結果発表！ ▼";
    default:
      return "▼ ゲーム進行中 ▼";
  }
};

export default function UniversalMonitor({
  room,
  players,
}: {
  room: RoomDoc | null;
  players: (PlayerDoc & { id: string })[];
}) {
  // アナウンスとお題は SimplePhaseDisplay 側の左上帯に統合
  return null;
}
