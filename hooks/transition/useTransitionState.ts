import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { TransitionLoadingStep } from "./types";

type ConfigureTransitionArgs = {
  from: string;
  to: string;
  direction: string;
  duration: number;
};

export interface TransitionStateSnapshot {
  isTransitioning: boolean;
  isLoading: boolean;
  currentStep: string;
  progress: number;
  fromPage: string;
  toPage: string;
  loadingSteps: TransitionLoadingStep[];
  pendingCompletion: boolean;
}

export interface TransitionStateActions {
  configureTransition: (args: ConfigureTransitionArgs) => void;
  resetPendingCompletion: () => void;
  startLoading: (steps: TransitionLoadingStep[]) => void;
  setCurrentStep: (stepId: string) => void;
  setProgress: (value: number) => void;
  beginTransition: () => void;
  completeTransition: () => void;
  completeLoading: () => void;
  cancelTransition: () => void;
  clearLoadingArtifacts: () => void;
}

export function useTransitionState(
  pathname: string,
  clearScheduledNavigation: () => void
): {
  state: TransitionStateSnapshot;
  transitionRef: MutableRefObject<{ direction: string; duration: number }>;
  actions: TransitionStateActions;
} {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStepState] = useState<string>("");
  const [progress, setProgressState] = useState(0);
  const [fromPage, setFromPage] = useState("");
  const [toPage, setToPage] = useState("");
  const [loadingSteps, setLoadingSteps] = useState<TransitionLoadingStep[]>([]);
  const [pendingCompletion, setPendingCompletion] = useState(false);

  const transitionRef = useRef({
    direction: "slideLeft",
    duration: 0.6,
  });

  const clearLoadingArtifacts = useCallback(() => {
    setProgressState(0);
    setCurrentStepState("");
    setLoadingSteps([]);
  }, []);

  const finalizeLoading = useCallback(() => {
    setIsLoading(false);
    clearLoadingArtifacts();
    setFromPage("");
    setToPage("");
    setPendingCompletion(false);
    clearScheduledNavigation();
  }, [clearLoadingArtifacts, clearScheduledNavigation]);

  useEffect(() => {
    if (!pendingCompletion) return;
    if (!toPage || pathname === toPage) {
      finalizeLoading();
    }
  }, [pendingCompletion, pathname, toPage, finalizeLoading]);

  const configureTransition = useCallback(
    ({ from, to, direction, duration }: ConfigureTransitionArgs) => {
      setPendingCompletion(false);
      setFromPage(from);
      setToPage(to);
      transitionRef.current = { direction, duration };
    },
    []
  );

  const startLoading = useCallback((steps: TransitionLoadingStep[]) => {
    setIsLoading(true);
    setProgressState(0);
    setLoadingSteps(steps);
    setCurrentStepState(steps[0]?.id ?? "");
  }, []);

  const beginTransition = useCallback(() => {
    clearLoadingArtifacts();
    setIsTransitioning(true);
  }, [clearLoadingArtifacts]);

  const completeTransition = useCallback(() => {
    setIsTransitioning(false);
    finalizeLoading();
  }, [finalizeLoading]);

  const completeLoading = useCallback(() => {
    if (toPage && pathname !== toPage) {
      setPendingCompletion(true);
      return;
    }
    finalizeLoading();
  }, [finalizeLoading, pathname, toPage]);

  const cancelTransition = useCallback(() => {
    setIsTransitioning(false);
    setIsLoading(false);
    clearLoadingArtifacts();
    clearScheduledNavigation();
  }, [clearLoadingArtifacts, clearScheduledNavigation]);

  const state = useMemo<TransitionStateSnapshot>(
    () => ({
      isTransitioning,
      isLoading,
      currentStep,
      progress,
      fromPage,
      toPage,
      loadingSteps,
      pendingCompletion,
    }),
    [
      isTransitioning,
      isLoading,
      currentStep,
      progress,
      fromPage,
      toPage,
      loadingSteps,
      pendingCompletion,
    ]
  );

  const actions = useMemo<TransitionStateActions>(
    () => ({
      configureTransition,
      resetPendingCompletion: () => setPendingCompletion(false),
      startLoading,
      setCurrentStep: setCurrentStepState,
      setProgress: setProgressState,
      beginTransition,
      completeTransition,
      completeLoading,
      cancelTransition,
      clearLoadingArtifacts,
    }),
    [
      configureTransition,
      startLoading,
      beginTransition,
      completeTransition,
      completeLoading,
      cancelTransition,
      clearLoadingArtifacts,
    ]
  );

  return { state, transitionRef, actions };
}
