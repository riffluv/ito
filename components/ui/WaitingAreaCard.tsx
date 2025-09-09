"use client";
import { GameCard } from "@/components/ui/GameCard";
import type { PlayerDoc } from "@/lib/types";
import { Box } from "@chakra-ui/react";
import { useDraggable } from "@dnd-kit/core";

interface WaitingAreaCardProps {
  player: PlayerDoc & { id: string };
  isDraggingEnabled?: boolean;
  meId?: string;
}

export default function WaitingAreaCard({
  player,
  isDraggingEnabled = false,
  meId,
}: WaitingAreaCardProps) {
  const ready = !!(player?.clue1 && player.clue1.trim() !== "");

  // ドラッグ機能（連想ワード確定後のみ有効）
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: player.id,
      // 本人のカード以外はドラッグ不可。連想ワード未確定も不可。
      disabled:
        !isDraggingEnabled || !ready || (meId ? player.id !== meId : true),
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.9 : 1,
        zIndex: isDragging ? 1000 : "auto",
        cursor:
          isDraggingEnabled && ready && meId === player.id
            ? isDragging
              ? "grabbing"
              : "grab"
            : "default",
        transition: isDragging ? "none" : "transform 0.2s ease",
      }
    : {
        cursor:
          isDraggingEnabled && ready && meId === player.id ? "grab" : "default",
        transition: "transform 0.2s ease",
      };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...(isDraggingEnabled && ready ? listeners : {})}
      {...(isDraggingEnabled && ready ? attributes : {})}
    >
      <GameCard
        index={0}
        name={player.name || ""}
        clue={ready ? player.clue1 || "Ready" : "Waiting"}
        number={null}
        state={ready ? (isDraggingEnabled ? "success" : "default") : "default"}
        waitingInCentral={true}
      />
    </Box>
  );
}
