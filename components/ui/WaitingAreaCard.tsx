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

  const style: React.CSSProperties = isDragging
    ? {
        // DragOverlay を使うため、元要素は動かさず不可視にする
        opacity: 0,
        pointerEvents: "none",
        cursor: "grabbing",
        transition: "none",
      }
    : {
        // 非ドラッグ時は通常の見た目
        cursor:
          isDraggingEnabled && ready && meId === player.id ? "grab" : "default",
        transition: "transform 0.2s ease",
      };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging ? "true" : undefined}
      {...(isDraggingEnabled && ready ? listeners : {})}
      {...(isDraggingEnabled && ready ? attributes : {})}
    >
      <GameCard
        index={null}
        name={player.name || ""}
        clue={ready ? player.clue1 || "Ready" : "Waiting"}
        number={null}
        state={ready ? "ready" : "default"}
        waitingInCentral={true}
      />
    </Box>
  );
}
