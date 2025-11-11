"use client";
import { GameCard } from "@/components/ui/GameCard";
import { createWaitingCardViewModel } from "./cardViewModel";
import type { PlayerDoc } from "@/lib/types";
import { Box } from "@chakra-ui/react";
import { useDraggable } from "@dnd-kit/core";
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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

  const deriveInitialClue = () => {
    if (ready) {
      return player?.clue1?.trim() || "";
    }
    return WAITING_LABEL;
  };

  const [displayClue, setDisplayClue] = useState<string>(deriveInitialClue);
  const promptShownRef = useRef(false);
  const waitingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    promptShownRef.current = false;
    if (waitingTimerRef.current !== null) {
      window.clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
  }, [player.id]);

  useEffect(() => {
    if (waitingTimerRef.current !== null) {
      window.clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }

    if (ready) {
      const clueText = player?.clue1?.trim() || "";
      setDisplayClue(clueText);
      promptShownRef.current = false;
      return;
    }

    if (!gameStarted) {
      const showImmediate = !promptShownRef.current;
      promptShownRef.current = false;
      if (showImmediate) {
        setDisplayClue(WAITING_LABEL);
      } else {
        waitingTimerRef.current = window.setTimeout(() => {
          setDisplayClue(WAITING_LABEL);
          waitingTimerRef.current = null;
        }, 220);
      }
      return;
    }

    if (promptShownRef.current) {
      setDisplayClue(PROMPT_LABEL);
      return;
    }

    promptShownRef.current = true;

    setDisplayClue(PROMPT_LABEL);
  }, [gameStarted, ready, player.clue1]);

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
  const { attributes, listeners, setNodeRef, isDragging } =
    useDraggable({
      id: player.id,
      // 本人のカード以外はドラッグ不可。連想ワード未確定も不可。
      disabled:
        !isDraggingEnabled || !ready || (meId ? player.id !== meId : true),
    });

  const baseStyle: CSSProperties = isDragging
    ? {
        opacity: 0,
        pointerEvents: "none",
        cursor: "grabbing",
        transition: "none",
      }
    : {
        cursor:
          isDraggingEnabled && ready && meId === player.id ? "grab" : "default",
        transition: "transform 0.28s ease",
      };
  const style: CSSProperties = baseStyle;

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
