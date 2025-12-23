import GameCard from "@/components/ui/GameCard";
import { computeCardState } from "@/lib/cards/logic";
import type { ResolveMode } from "@/lib/game/resolveMode";
import type { PlayerDoc } from "@/lib/types";
import { createBoardCardViewModel } from "./cardViewModel";
import { useRenderMetrics } from "@/lib/perf/useRenderMetrics";
import { memo, useMemo } from "react";

interface CardRendererProps {
  id: string;
  player: (PlayerDoc & { id: string }) | undefined;
  idx?: number;
  orderList?: string[];
  pending: (string | null)[];
  proposal?: (string | null)[];
  resolveMode?: ResolveMode | null;
  roomStatus?: string;
  revealIndex: number;
  revealAnimating: boolean;
  failed?: boolean;
  realtimeResult?: {
    success: boolean;
    failedAt: number | null;
    currentIndex: number;
  } | null;
  interactiveFlip?: {
    flipped: boolean;
    onToggle: () => void;
    preset?: "result";
  };
}

function CardRendererBase(props: CardRendererProps) {
  const { id, player } = props;
  const state = computeCardState({
    player,
    id,
    idx: props.idx,
    orderList: props.orderList,
    pending: props.pending,
    proposal: props.proposal,
    resolveMode: props.resolveMode ?? undefined,
    roomStatus: props.roomStatus,
    revealIndex: props.revealIndex,
    revealAnimating: props.revealAnimating,
    failed: props.failed,
    realtimeResult: props.realtimeResult ?? null,
  });

  useRenderMetrics("CardRenderer", { thresholdMs: 4 });

  const interactive = useMemo(() => {
    if (!props.interactiveFlip) return undefined;
    return props.interactiveFlip;
  }, [props.interactiveFlip]);

  const variant = interactive ? "flip" : state.variant;
  const flipped = interactive ? interactive.flipped : state.flipped;
  const flipPreset = interactive?.preset ?? "reveal";

  const cardViewModel = useMemo(
    () =>
      createBoardCardViewModel({
        player,
        index: typeof props.idx === "number" ? props.idx : null,
        state,
        variant,
        flipped,
        isInteractive: !!interactive,
        flipPreset,
        onClick: interactive ? interactive.onToggle : undefined,
      }),
    [
      player,
      props.idx,
      state,
      variant,
      flipped,
      interactive,
      flipPreset,
    ]
  );

  return <GameCard key={id} dataCardId={id} {...cardViewModel} />;
}

export const CardRenderer = memo(CardRendererBase);
CardRenderer.displayName = "CardRenderer";
