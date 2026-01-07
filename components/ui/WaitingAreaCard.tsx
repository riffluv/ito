"use client";
import { GameCard } from "@/components/ui/GameCard";
import { createWaitingCardViewModel } from "./cardViewModel";
import type { PlayerDoc } from "@/lib/types";
import { Box } from "@chakra-ui/react";
import { useDraggable } from "@dnd-kit/core";
import { memo, useMemo, type CSSProperties } from "react";
import { WAITING_LABEL } from "@/lib/ui/constants";

interface WaitingAreaCardProps {
  player: PlayerDoc & { id: string };
  isDraggingEnabled?: boolean;
  meId?: string;
  optimisticReset?: boolean;
  gameStarted?: boolean;
}

function buildWaitingCardViewModel(params: {
  player: PlayerDoc & { id: string };
  optimisticReset: boolean;
  gameStarted: boolean;
}) {
  const { player, optimisticReset, gameStarted } = params;
  const hasValidClue = !!(player?.clue1 && player.clue1.trim() !== "");
  const ready = !optimisticReset && hasValidClue;

  const PROMPT_LABEL = "Add your hint.";
  const displayClue = ready ? player?.clue1?.trim() || "" : gameStarted ? PROMPT_LABEL : WAITING_LABEL;

  const base = createWaitingCardViewModel({ player, ready });
  if (!ready) {
    return { ...base, clue: displayClue };
  }
  return {
    ...base,
    clue: player.clue1?.trim() || base.clue,
    variant: base.variant,
    flipped: false,
  };
}

function DraggableWaitingAreaCard({
  player,
  optimisticReset,
  gameStarted,
}: {
  player: PlayerDoc & { id: string };
  optimisticReset: boolean;
  gameStarted: boolean;
}) {
  const cardViewModel = useMemo(
    () => buildWaitingCardViewModel({ player, optimisticReset, gameStarted }),
    [player, optimisticReset, gameStarted]
  );

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    disabled: false,
  });

  const baseStyle: CSSProperties = isDragging
    ? {
        opacity: 0,
        pointerEvents: "none",
        cursor: "grabbing",
        transition: "none",
      }
    : {
        cursor: "grab",
        transition: "transform 0.28s ease",
      };
  const style: CSSProperties = {
    ...baseStyle,
    // Prevent mobile browsers from treating the gesture as scroll, which can cancel the drag.
    touchAction: "none",
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      bg="transparent"
      aria-grabbed={isDragging ? "true" : "false"}
      aria-label={player.name ? `${player.name}のカード` : "カード"}
      data-dragging={isDragging ? "true" : undefined}
      data-waiting-card="true"
      data-player-id={player.id}
      data-player-name={player.name || "匿名"}
      {...listeners}
      {...attributes}
    >
      <GameCard {...cardViewModel} />
    </Box>
  );
}

function StaticWaitingAreaCard({
  player,
  draggableHint,
  optimisticReset,
  gameStarted,
}: {
  player: PlayerDoc & { id: string };
  draggableHint: boolean;
  optimisticReset: boolean;
  gameStarted: boolean;
}) {
  const cardViewModel = useMemo(
    () => buildWaitingCardViewModel({ player, optimisticReset, gameStarted }),
    [player, optimisticReset, gameStarted]
  );
  const style: CSSProperties = {
    cursor: draggableHint ? "grab" : "default",
    transition: "transform 0.28s ease",
  };

  return (
    <Box
      style={style}
      bg="transparent"
      aria-grabbed="false"
      aria-label={player.name ? `${player.name}のカード` : "カード"}
      data-waiting-card="true"
      data-player-id={player.id}
      data-player-name={player.name || "匿名"}
    >
      <GameCard {...cardViewModel} />
    </Box>
  );
}

function WaitingAreaCardComponent({
  player,
  isDraggingEnabled = false,
  meId,
  optimisticReset = false,
  gameStarted = false,
}: WaitingAreaCardProps) {
  const hasValidClue = !!(player?.clue1 && player.clue1.trim() !== "");
  const ready = !optimisticReset && hasValidClue;
  const draggable =
    isDraggingEnabled && ready && typeof meId === "string" && meId.length > 0 && player.id === meId;

  if (draggable) {
    return (
      <DraggableWaitingAreaCard
        player={player}
        optimisticReset={optimisticReset}
        gameStarted={gameStarted}
      />
    );
  }

  return (
    <StaticWaitingAreaCard
      player={player}
      draggableHint={isDraggingEnabled && typeof meId === "string" && player.id === meId}
      optimisticReset={optimisticReset}
      gameStarted={gameStarted}
    />
  );
}

const propsAreEqual = (prev: WaitingAreaCardProps, next: WaitingAreaCardProps) => {
  if (prev.isDraggingEnabled !== next.isDraggingEnabled) return false;
  if (prev.meId !== next.meId) return false;
  if (prev.optimisticReset !== next.optimisticReset) return false;
  if (prev.gameStarted !== next.gameStarted) return false;

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
