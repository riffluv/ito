"use client";
import { GameCard } from "@/components/ui/GameCard";
import { createWaitingCardViewModel } from "./cardViewModel";
import type { PlayerDoc } from "@/lib/types";
import { Box } from "@chakra-ui/react";
import { useDraggable } from "@dnd-kit/core";
import { memo, useMemo } from "react";
import type { CSSProperties } from "react";

interface WaitingAreaCardProps {
  player: PlayerDoc & { id: string };
  isDraggingEnabled?: boolean;
  meId?: string;
  optimisticReset?: boolean;
}

function WaitingAreaCardComponent({
  player,
  isDraggingEnabled = false,
  meId,
  optimisticReset = false,
}: WaitingAreaCardProps) {
  // 連想ワードの有効性を厳密にチェック（空文字列も無効とする）
  const hasValidClue = !!(player?.clue1 && player.clue1.trim() !== "");
  const ready = !optimisticReset && hasValidClue;

  const cardViewModel = useMemo(
    () => createWaitingCardViewModel({ player, ready }),
    [player, ready]
  );

  // ドラッグ機能（連想ワード確定後のみ有効）
  const { attributes, listeners, setNodeRef, isDragging } =
    useDraggable({
      id: player.id,
      // 本人のカード以外はドラッグ不可。連想ワード未確定も不可。
      disabled:
        !isDraggingEnabled || !ready || (meId ? player.id !== meId : true),
    });

  const style: CSSProperties = isDragging
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
      bg="transparent"
      data-dragging={isDragging ? "true" : undefined}
      {...(isDraggingEnabled && ready ? listeners : {})}
      {...(isDraggingEnabled && ready ? attributes : {})}
    >
      <GameCard {...cardViewModel} />
    </Box>
  );
}

const propsAreEqual = (prev: WaitingAreaCardProps, next: WaitingAreaCardProps) => {
  if (prev.isDraggingEnabled !== next.isDraggingEnabled) return false;
  if (prev.meId !== next.meId) return false;
  if (prev.optimisticReset !== next.optimisticReset) return false;

  const prevPlayer = prev.player;
  const nextPlayer = next.player;

  return (
    prevPlayer.id === nextPlayer.id &&
    prevPlayer.name === nextPlayer.name &&
    prevPlayer.clue1 === nextPlayer.clue1 &&
    prevPlayer.number === nextPlayer.number
  );
};

export default memo(WaitingAreaCardComponent, propsAreEqual);
