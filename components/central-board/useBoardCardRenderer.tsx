import { useCallback } from "react";

import { CardRenderer } from "@/components/ui/CardRenderer";
import type { ResolveMode } from "@/lib/game/resolveMode";
import type { PlayerDoc, RoomDoc } from "@/lib/types";

import { useResultFlipState } from "./useResultFlipState";

type RealtimeResult = {
  success: boolean;
  failedAt: number | null;
  currentIndex: number;
} | null;

export function useBoardCardRenderer(params: {
  roomStatus: RoomDoc["status"];
  orderList: string[];
  playerMap: Map<string, PlayerDoc & { id: string }>;
  pending: (string | null)[];
  proposal: (string | null)[] | undefined;
  resolveMode: ResolveMode | null | undefined;
  revealIndex: number;
  revealAnimating: boolean;
  failed: boolean;
  realtimeResult: RealtimeResult;
}): { renderCard: (id: string, idx?: number) => JSX.Element } {
  const {
    roomStatus,
    orderList,
    playerMap,
    pending,
    proposal,
    resolveMode,
    revealIndex,
    revealAnimating,
    failed,
    realtimeResult,
  } = params;

  const { resultFlipMap, handleResultCardFlip } = useResultFlipState(
    // useResultFlipState は finished 以外で noop & reset する
    roomStatus,
    orderList
  );

  const renderCard = useCallback(
    (id: string, idx?: number) => {
      const interactiveFlip =
        roomStatus === "finished"
          ? {
              flipped: resultFlipMap[id] ?? true,
              onToggle: () => handleResultCardFlip(id),
              preset: "result" as const,
            }
          : undefined;

      return (
        <CardRenderer
          key={id}
          id={id}
          player={playerMap.get(id)}
          idx={idx}
          orderList={orderList}
          pending={pending}
          proposal={proposal}
          resolveMode={resolveMode}
          roomStatus={roomStatus}
          revealIndex={revealIndex}
          revealAnimating={revealAnimating}
          failed={failed}
          realtimeResult={realtimeResult}
          interactiveFlip={interactiveFlip}
        />
      );
    },
    [
      failed,
      handleResultCardFlip,
      orderList,
      pending,
      playerMap,
      proposal,
      realtimeResult,
      revealAnimating,
      revealIndex,
      resolveMode,
      resultFlipMap,
      roomStatus,
    ]
  );

  return { renderCard };
}
