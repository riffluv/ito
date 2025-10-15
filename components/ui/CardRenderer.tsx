import GameCard from "@/components/ui/GameCard";
import { computeCardState } from "@/lib/cards/logic";
import type { PlayerDoc } from "@/lib/types";
import { createBoardCardViewModel } from "./cardViewModel";
import { useRenderMetrics } from "@/lib/perf/useRenderMetrics";

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

export function CardRenderer(props: CardRendererProps) {
  const { id, player } = props;
  const state = computeCardState({
    player,
    id,
    idx: props.idx,
    orderList: props.orderList,
    pending: props.pending,
    proposal: props.proposal,
    resolveMode: props.resolveMode,
    roomStatus: props.roomStatus,
    revealIndex: props.revealIndex,
    revealAnimating: props.revealAnimating,
    failed: props.failed,
    realtimeResult: props.realtimeResult ?? null,
  });

  useRenderMetrics("CardRenderer", { thresholdMs: 4 });

  const interactive = props.interactiveFlip;
  const variant = interactive ? "flip" : state.variant;
  const flipped = interactive ? interactive.flipped : state.flipped;
  const flipPreset = interactive?.preset ?? "reveal";

  const cardViewModel = createBoardCardViewModel({
    player,
    index: typeof props.idx === "number" ? props.idx : null,
    state,
    variant,
    flipped,
    isInteractive: !!interactive,
    flipPreset,
    onClick: interactive ? interactive.onToggle : undefined,
  });

  return <GameCard key={id} {...cardViewModel} />;
}
