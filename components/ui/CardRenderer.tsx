import React from "react";
import { Text } from "@chakra-ui/react";
import GameCard from "@/components/ui/GameCard";
import type { PlayerDoc } from "@/lib/types";

interface CardRendererProps {
  id: string;
  player: (PlayerDoc & { id: string }) | undefined;
  idx?: number;
  orderList?: string[];
  pending: string[];
  proposal?: string[];
  resolveMode?: string;
  roomStatus?: string;
  revealIndex: number;
  revealAnimating: boolean;
  failed?: boolean;
  failedAt?: number | null;
  localFailedAt?: number | null;
}

export function CardRenderer({
  id,
  player,
  idx,
  orderList,
  pending,
  proposal,
  resolveMode,
  roomStatus,
  revealIndex,
  revealAnimating,
  failed,
  failedAt,
  localFailedAt,
}: CardRendererProps) {
  const number = player?.number;
  const isPlaced =
    (orderList || []).includes(id) ||
    pending.includes(id) ||
    (proposal || []).includes(id);

  const numberVisibleBase = typeof number === "number" && isPlaced;
  let showNumber = numberVisibleBase;

  if (resolveMode === "sort-submit" && roomStatus !== "finished") {
    showNumber = false;
  }

  if (revealAnimating && typeof idx === "number") {
    showNumber = idx < revealIndex;
  }

  const effectiveFailedAt = localFailedAt ?? failedAt;
  
  const failureConfirmed = (() => {
    if (typeof effectiveFailedAt !== "number") return false;
    if (resolveMode === "sort-submit") {
      if (roomStatus === "finished") return !!failed;
      return revealIndex >= effectiveFailedAt;
    }
    return true;
  })();

  const cardIsRevealed =
    resolveMode === "sort-submit"
      ? typeof idx === "number" &&
        (roomStatus === "finished" ||
          (roomStatus === "reveal" && idx < revealIndex))
      : isPlaced;

  const shouldShowGreen = cardIsRevealed && !failureConfirmed;
  const shouldShowRed = cardIsRevealed && failureConfirmed;

  const persistentFlip =
    resolveMode === "sort-submit" && typeof idx === "number";
  const flipped =
    persistentFlip &&
    (roomStatus === "finished"
      ? true
      : roomStatus === "reveal" && idx < revealIndex);

  if (persistentFlip) {
    return (
      <GameCard
        key={id}
        variant="flip"
        flipped={flipped}
        index={typeof idx === "number" ? idx : null}
        name={player?.name}
        clue={player?.clue1}
        number={typeof number === "number" ? number : null}
        state={
          shouldShowRed ? "fail" : shouldShowGreen ? "success" : "default"
        }
      />
    );
  }

  return (
    <>
      <GameCard
        key={id}
        variant="flat"
        index={typeof idx === "number" ? idx : null}
        name={player?.name}
        clue={
          resolveMode === "sort-submit" && roomStatus !== "finished"
            ? player?.clue1 || "(連想待ち)"
            : player?.clue1
        }
        number={showNumber && typeof number === "number" ? number : null}
        state={
          shouldShowRed ? "fail" : shouldShowGreen ? "success" : "default"
        }
      />
      {typeof effectiveFailedAt === "number" &&
        typeof idx === "number" &&
        effectiveFailedAt === idx + 1 &&
        cardIsRevealed && (
          <Text mt={2} fontSize="xs" color="red.300" fontWeight="bold">
            ← ここで失敗！
          </Text>
        )}
    </>
  );
}