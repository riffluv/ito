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
  failedAt?: number | null;
  localFailedAt?: number | null;
  boundaryPreviousIndex?: number | null;
  sequentialFlippedIds?: Set<string>; // 順次モード用の正確なフリップ状態
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
    failedAt: props.failedAt ?? null,
    localFailedAt: props.localFailedAt ?? null,
    boundaryPreviousIndex: props.boundaryPreviousIndex ?? null,
    sequentialFlip: props.resolveMode !== "sort-submit", // enable flip for sequential
    sequentialFlippedIds: props.sequentialFlippedIds, // 正確なフリップ状態を渡す
  });

  return (
    <GameCard
      key={id}
      variant={state.variant}
      flipped={state.flipped}
      index={typeof props.idx === "number" ? props.idx : null}
      name={player?.name}
      clue={state.clueText || undefined}
      number={state.number}
      state={state.state}
      successLevel={state.successLevel}
      boundary={state.boundary}
      // boundary styling hint via name prop aria? (Could be extended)
    />
  );
}
