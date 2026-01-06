import { useBoardDropAnimation } from "./useBoardDropAnimation";
import { useBoardSlotCountState } from "./useBoardSlotCountState";

export function useBoardDropSessionSystem(params: {
  slotCount?: number;
  availableEligibleCount: number;
  boardProposal: (string | null)[];
  prefersReducedMotion: boolean;
}): {
  resolvedSlotCount: number;
  beginDropSession: () => void;
  endDropSession: () => void;
  paddedBoardProposal: (string | null)[];
  dropAnimation: ReturnType<typeof useBoardDropAnimation>["dropAnimation"];
  updateDropAnimationTarget: ReturnType<
    typeof useBoardDropAnimation
  >["updateDropAnimationTarget"];
} {
  const { resolvedSlotCount, beginDropSession, endDropSession, paddedBoardProposal } =
    useBoardSlotCountState(params);

  const { dropAnimation, updateDropAnimationTarget } = useBoardDropAnimation({
    prefersReducedMotion: params.prefersReducedMotion,
  });

  return {
    resolvedSlotCount,
    beginDropSession,
    endDropSession,
    paddedBoardProposal,
    dropAnimation,
    updateDropAnimationTarget,
  };
}

