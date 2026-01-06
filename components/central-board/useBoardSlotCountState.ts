import { useMemo } from "react";
import { computeSlotCountTarget } from "./boardDerivations";
import { useResolvedSlotCount } from "./useResolvedSlotCount";

function padProposalToLength(
  proposal: (string | null)[],
  target: number
): (string | null)[] {
  if (proposal.length >= target) return proposal;
  const next = proposal.slice();
  while (next.length < target) {
    next.push(null);
  }
  return next;
}

export function useBoardSlotCountState(params: {
  slotCount?: number;
  availableEligibleCount: number;
  boardProposal: (string | null)[];
  prefersReducedMotion: boolean;
}): {
  resolvedSlotCount: number;
  beginDropSession: () => void;
  endDropSession: () => void;
  paddedBoardProposal: (string | null)[];
} {
  const { slotCount, availableEligibleCount, boardProposal, prefersReducedMotion } =
    params;

  const slotCountTarget = useMemo(() => {
    // サーバー計算済みの slotCount を信頼し、在室人数で最低値を張る。pending やローカル提案では揺らさない。
    return computeSlotCountTarget(slotCount, availableEligibleCount);
  }, [slotCount, availableEligibleCount]);

  const { resolvedSlotCount, beginDropSession, endDropSession } =
    useResolvedSlotCount({ slotCountTarget, prefersReducedMotion });

  const paddedBoardProposal = useMemo<(string | null)[]>(() => {
    return padProposalToLength(boardProposal, resolvedSlotCount);
  }, [boardProposal, resolvedSlotCount]);

  return { resolvedSlotCount, beginDropSession, endDropSession, paddedBoardProposal };
}

