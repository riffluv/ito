import type { PlayerDoc } from "@/lib/types";
import type { ComputedCardState } from "@/lib/cards/logic";
import { WAITING_LABEL } from "@/lib/ui/constants";
import type { GameCardProps } from "./GameCard";

export type CardViewModel = Pick<
  GameCardProps,
  | "index"
  | "name"
  | "clue"
  | "number"
  | "state"
  | "successLevel"
  | "boundary"
  | "variant"
  | "flipped"
  | "waitingInCentral"
  | "isInteractive"
  | "flipPreset"
> & {
  onClick?: GameCardProps["onClick"];
};

interface BoardCardParams {
  player: (PlayerDoc & { id: string }) | undefined;
  index: number | null;
  state: ComputedCardState;
  variant: NonNullable<GameCardProps["variant"]>;
  flipped: boolean;
  isInteractive: boolean;
  flipPreset: NonNullable<GameCardProps["flipPreset"]>;
  onClick?: GameCardProps["onClick"];
}

export function createBoardCardViewModel(params: BoardCardParams): CardViewModel {
  const { player, index, state, variant, flipped, isInteractive, flipPreset, onClick } = params;

  return {
    index,
    name: player?.name ?? "",
    clue: state.clueText ?? undefined,
    number: state.number,
    state: state.state,
    successLevel: state.successLevel,
    boundary: state.boundary,
    variant,
    flipped,
    waitingInCentral: state.waitingInCentral,
    isInteractive,
    flipPreset,
    onClick,
  };
}

interface WaitingCardParams {
  player: PlayerDoc & { id: string };
  ready: boolean;
}

export function createWaitingCardViewModel({ player, ready }: WaitingCardParams): CardViewModel {
  return {
    index: null,
    name: player.name ?? "",
    clue: ready ? player.clue1 ?? undefined : WAITING_LABEL,
    number: null,
    state: ready ? "ready" : "default",
    successLevel: undefined,
    boundary: false,
    variant: "flat",
    flipped: false,
    waitingInCentral: true,
    isInteractive: false,
    flipPreset: "reveal",
    onClick: undefined,
  };
}
