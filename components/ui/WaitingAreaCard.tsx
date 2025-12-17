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

function WaitingAreaCardComponent({
  player,
  isDraggingEnabled = false,
  meId,
  optimisticReset = false,
  gameStarted = false,
}: WaitingAreaCardProps) {
  // 連想ワードの有効性を厳密にチェック（空文字列も無効とする）
  const hasValidClue = !!(player?.clue1 && player.clue1.trim() !== "");
  const ready = !optimisticReset && hasValidClue;

  const PROMPT_LABEL = "Add your hint.";

  const displayClue = useMemo(() => {
    if (ready) {
      return player?.clue1?.trim() || "";
    }
    return gameStarted ? PROMPT_LABEL : WAITING_LABEL;
  }, [gameStarted, player?.clue1, ready]);

  const cardViewModel = useMemo(() => {
    const base = createWaitingCardViewModel({ player, ready });
    if (!ready) {
      return {
        ...base,
        clue: displayClue,
      };
    }
    return {
      ...base,
      clue: player.clue1?.trim() || base.clue,
      variant: base.variant,
      flipped: false,
    };
  }, [player, ready, displayClue]);

  // ドラッグ機能（連想ワード確定後のみ有効）
  const draggable =
    isDraggingEnabled && ready && (meId ? player.id === meId : false);
  const { attributes, listeners, setNodeRef, isDragging } =
    useDraggable({
      id: player.id,
      // 本人のカード以外はドラッグ不可。連想ワード未確定も不可。
      disabled:
        !draggable,
    });

  const baseStyle: CSSProperties = isDragging
    ? {
        opacity: 0,
        pointerEvents: "none",
        cursor: "grabbing",
        transition: "none",
      }
    : {
        cursor: draggable ? "grab" : "default",
        transition: "transform 0.28s ease",
      };
  const style: CSSProperties = {
    ...baseStyle,
    // Prevent mobile browsers from treating the gesture as scroll, which can
    // cancel the drag and lead to "dropped but not submitted" feeling.
    ...(draggable ? { touchAction: "none" } : {}),
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      bg="transparent"
      aria-grabbed={isDragging ? "true" : "false"}
      aria-label={player.name ? `${player.name}のカード` : "カード"}
      data-dragging={isDragging ? "true" : undefined}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
    >
      <GameCard {...cardViewModel} />
    </Box>
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
