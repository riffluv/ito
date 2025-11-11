"use client";
import type { PlayerDoc, RoomDoc } from "@/lib/types";

export default function UniversalMonitor({
  room: _room,
  players: _players,
}: {
  room: RoomDoc | null;
  players: (PlayerDoc & { id: string })[];
}) {
  // アナウンスとお題は SimplePhaseDisplay 側の左上帯に統合
  return null;
}
