"use client";
import React from "react";
import type { PlayerDoc } from "@/lib/types";
import { GameCard } from "@/components/ui/GameCard";
import { useDraggable } from "@dnd-kit/core";
import { Box } from "@chakra-ui/react";

interface WaitingAreaCardProps {
  player: PlayerDoc & { id: string };
  isDraggingEnabled?: boolean;
}

export default function WaitingAreaCard({
  player,
  isDraggingEnabled = false,
}: WaitingAreaCardProps) {
  const ready = !!(player?.clue1 && player.clue1.trim() !== "");
  
  // ドラッグ機能（連想ワード確定後のみ有効）
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: player.id,
    disabled: !isDraggingEnabled || !ready, // 連想ワード未確定時は無効
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : "auto",
    cursor: isDraggingEnabled && ready ? (isDragging ? "grabbing" : "grab") : "default",
    scale: isDragging ? 1.05 : 1,
    transition: isDragging ? 'none' : 'all 0.2s ease',
  } : {
    cursor: isDraggingEnabled && ready ? "grab" : "default",
    transition: 'all 0.2s ease',
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
        clue={ready ? (player.clue1 || "Ready") : "Waiting"}
        number={null}
        state={ready ? (isDraggingEnabled ? "success" : "default") : "default"}
        waitingInCentral={true}
      />
    </Box>
  );
}