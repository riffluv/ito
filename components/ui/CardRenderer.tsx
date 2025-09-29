import GameCard from "@/components/ui/GameCard";
import { computeCardState } from "@/lib/cards/logic";
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

  const interactive = props.interactiveFlip;
  const variant = interactive ? "flip" : state.variant;
  const flipped = interactive ? interactive.flipped : state.flipped;
  const flipPreset = interactive?.preset ?? "reveal";

  return (
    <GameCard
      key={id}
      variant={variant}
      flipped={flipped}
      index={typeof props.idx === "number" ? props.idx : null}
      name={player?.name}
      clue={state.clueText || undefined}
      number={state.number}
      state={state.state}
      successLevel={state.successLevel}
      boundary={state.boundary}
      waitingInCentral={state.waitingInCentral}
      isInteractive={!!interactive}
      onClick={interactive ? interactive.onToggle : undefined}
      flipPreset={flipPreset}
      // boundary styling hint via name prop aria? (Could be extended)
    />
  );
}

