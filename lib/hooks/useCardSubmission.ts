import { notify } from "@/components/ui/notify";
import { KEYBOARD_KEYS } from "@/components/ui/hints/constants";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import {
  addCardToProposal,
  commitPlayFromClue,
  removeCardFromProposal,
} from "@/lib/game/service";
import {
  canSubmitCard,
  computeAllSubmitted,
  isSortSubmit,
  normalizeResolveMode,
  type ResolveMode,
} from "@/lib/game/resolveMode";
import type { PlayerDoc } from "@/lib/types";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { toastIds } from "@/lib/ui/toastIds";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

type UseCardSubmissionOptions = {
  roomId: string;
  roomStatus?: string;
  resolveMode?: ResolveMode | null;
  player: (PlayerDoc & { id: string }) | null | undefined;
  proposal?: (string | null)[] | null;
  eligibleIds?: string[];
  cluesReady?: boolean;
  clueEditable: boolean;
  inputRef: RefObject<HTMLElement>;
  onFeedback?: (payload: { message: string; tone: "info" | "success" } | null) => void;
  isRevealAnimating?: boolean;
  updateOptimisticProposal?: (
    playerId: string,
    state: "placed" | "removed" | null,
    targetIndex?: number | null
  ) => void;
};

export function useCardSubmission({
  roomId,
  roomStatus,
  resolveMode,
  player,
  proposal,
  eligibleIds,
  cluesReady,
  clueEditable,
  inputRef,
  onFeedback,
  isRevealAnimating,
  updateOptimisticProposal,
}: UseCardSubmissionOptions) {
  const actualResolveMode = normalizeResolveMode(resolveMode);
  const isSortMode = isSortSubmit(actualResolveMode);
  const playerId = player?.id ?? null;
  const ready = !!player?.ready;
  const placed = useMemo(() => {
    if (!playerId) return false;
    return Array.isArray(proposal) ? proposal.includes(playerId) : false;
  }, [playerId, proposal]);

  const allSubmitted = useMemo(
    () =>
      computeAllSubmitted({
        mode: actualResolveMode,
        eligibleIds: eligibleIds ?? undefined,
        proposal: proposal ?? undefined,
      }),
    [actualResolveMode, eligibleIds, proposal]
  );

  const canSubmitBase = useMemo(
    () =>
      canSubmitCard({
        mode: actualResolveMode,
        canDecide:
          !!playerId &&
          typeof player?.number === "number" &&
          !!player?.clue1?.trim(),
        ready,
        placed,
        cluesReady,
      }),
    [
      actualResolveMode,
      playerId,
      player?.number,
      player?.clue1,
      ready,
      placed,
      cluesReady,
    ]
  );

  const canSubmit = clueEditable && canSubmitBase;
  const [actionInFlight, setActionInFlight] = useState(false);
  useEffect(() => {
    setActionInFlight(false);
  }, [playerId]);
  const canClickProposalButton = useMemo(() => {
    if (actionInFlight) return false;
    if (!playerId) return false;
    if (!clueEditable) return false;
    if (isSortMode) {
      return placed || canSubmitBase;
    }
    return canSubmit;
  }, [
    actionInFlight,
    playerId,
    clueEditable,
    isSortMode,
    placed,
    canSubmitBase,
    canSubmit,
  ]);

  const actionLabel = isSortMode && placed ? "戻す" : "出す";

  const playCardPlace = useSoundEffect("card_place");
  const playDropInvalid = useSoundEffect(undefined);

  const submitHintShownRef = useRef(false);
  const [shouldShowSubmitHint, setShouldShowSubmitHint] = useState(false);
  const resetSubmitHint = useCallback(() => {
    submitHintShownRef.current = false;
    setShouldShowSubmitHint(false);
  }, []);
  const applyOptimisticProposal = useCallback(
    (state: "placed" | "removed" | null) => {
      if (!playerId || !updateOptimisticProposal) return;
      updateOptimisticProposal(playerId, state);
    },
    [playerId, updateOptimisticProposal]
  );

  const handleSubmit = useCallback(async () => {
    if (actionInFlight) return;
    if (!playerId || !clueEditable) return;

    const removing = isSortMode && placed;
    if (isSortMode) {
      if (!placed && !canSubmit) return;
    } else {
      if (!canSubmit || !cluesReady) return;
    }

    setActionInFlight(true);
    let didSucceed = false;
    let optimisticState: "placed" | "removed" | null = null;
    const actionName = isSortMode
      ? removing
        ? "ui.card.remove"
        : "ui.card.submit"
      : "ui.card.submit";
    try {
      if (isSortMode) {
        if (removing) {
          optimisticState = "removed";
          applyOptimisticProposal("removed");
          traceAction(actionName, { roomId, playerId });
          const removalPromise = removeCardFromProposal(roomId, playerId);
          playCardPlace();
          window.dispatchEvent(
            new CustomEvent("ito:card-returning", {
              detail: { roomId, playerId },
            })
          );
          await removalPromise;
          onFeedback?.({
            message: "カードを待機エリアに戻しました",
            tone: "info",
          });
          didSucceed = true;
        } else {
          optimisticState = "placed";
          applyOptimisticProposal("placed");
          traceAction(actionName, { roomId, playerId });
          const submitPromise = addCardToProposal(roomId, playerId);
          playCardPlace();
          const result = await submitPromise;
          if (result === "noop") {
            applyOptimisticProposal(null);
            onFeedback?.({
              message: "カードは既に提出済みです",
              tone: "info",
            });
          } else {
            onFeedback?.({
              message: "カードを提出しました",
              tone: "success",
            });
          }
          didSucceed = true;
        }
      } else {
        optimisticState = "placed";
        applyOptimisticProposal("placed");
        traceAction(actionName, { roomId, playerId });
        const commitPromise = commitPlayFromClue(roomId, playerId);
        playCardPlace();
        await commitPromise;
        onFeedback?.({ message: "カードを提出しました", tone: "success" });
        didSucceed = true;
      }
    } catch (error: unknown) {
      traceError(actionName, error, { roomId, playerId });
      playDropInvalid();
      if (optimisticState) {
        applyOptimisticProposal(null);
      }
      const label = removing ? "カードを戻す" : "カードを出す";
      if (isFirebaseQuotaExceeded(error)) {
        handleFirebaseQuotaError(label);
        notify({
          id: toastIds.firebaseLimit(roomId, "card-action"),
          title: "Firebase 制限により処理できません",
          description:
            "現在カード操作を完了できません。しばらく待って再度お試しください。",
          type: "error",
        });
      } else {
        notify({
          id: toastIds.cardActionError(roomId),
          title: `${label}処理に失敗しました`,
          description: error instanceof Error ? error.message : String(error ?? "unknown"),
          type: "error",
        });
      }
    } finally {
      setActionInFlight(false);
    }

    if (didSucceed) {
      resetSubmitHint();
    }
  }, [
    actionInFlight,
    playerId,
    clueEditable,
    isSortMode,
    placed,
    canSubmit,
    cluesReady,
    roomId,
    playCardPlace,
    playDropInvalid,
    onFeedback,
    resetSubmitHint,
    applyOptimisticProposal,
  ]);

  const isSubmitHintEligible =
    roomStatus === "clue" &&
    !isRevealAnimating &&
    canClickProposalButton &&
    actionLabel === "出す";

  useEffect(() => {
    if (isSubmitHintEligible && !submitHintShownRef.current) {
      submitHintShownRef.current = true;
      setShouldShowSubmitHint(true);
      return;
    }
    if (!isSubmitHintEligible) {
      resetSubmitHint();
    }
  }, [isSubmitHintEligible, resetSubmitHint]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (event: KeyboardEvent) => {
      if (!isSubmitHintEligible) return;
      if (event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key?.toLowerCase() !== KEYBOARD_KEYS.E) return;
      const target = event.target as HTMLElement | null;
      if (target === inputRef.current) {
        event.preventDefault();
        inputRef.current?.blur();
        void handleSubmit();
        return;
      }
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      void handleSubmit();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSubmit, inputRef, isSubmitHintEligible]);

  return {
    actualResolveMode,
    isSortMode,
    placed,
    ready,
    canSubmit,
    canSubmitBase,
    canClickProposalButton,
    actionLabel,
    allSubmitted,
    shouldShowSubmitHint,
    isSubmitHintEligible,
    resetSubmitHint,
    handleSubmit,
  };
}
