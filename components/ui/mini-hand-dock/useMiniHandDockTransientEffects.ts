"use client";

import React from "react";

const noopCleanup = () => {};

export type MiniHandDockInlineFeedback = {
  message: string;
  tone: "info" | "success";
};

type MiniHandDockTransientEffectsParams = {
  ready: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  inlineFeedback: MiniHandDockInlineFeedback | null;
  setInlineFeedback: React.Dispatch<
    React.SetStateAction<MiniHandDockInlineFeedback | null>
  >;
  clueEditable: boolean;
  shouldShowSubmitHint: boolean;
  resetSubmitHint: () => void;
};

export function useMiniHandDockTransientEffects(
  params: MiniHandDockTransientEffectsParams
) {
  const {
    ready,
    inputRef,
    inlineFeedback,
    setInlineFeedback,
    clueEditable,
    shouldShowSubmitHint,
    resetSubmitHint,
  } = params;

  React.useEffect(() => {
    if (!ready) return;
    const element = inputRef.current;
    if (!element) return;
    if (typeof window === "undefined") return;
    if (document.activeElement === element) {
      element.blur();
    }
  }, [inputRef, ready]);

  React.useEffect(() => {
    if (!inlineFeedback || inlineFeedback.tone === "info") {
      return noopCleanup;
    }
    const timer = window.setTimeout(() => setInlineFeedback(null), 2000);
    return () => window.clearTimeout(timer);
  }, [inlineFeedback, setInlineFeedback]);

  React.useEffect(() => {
    if (!clueEditable) {
      setInlineFeedback(null);
    }
  }, [clueEditable, setInlineFeedback]);

  React.useEffect(() => {
    if (!shouldShowSubmitHint) {
      return noopCleanup;
    }
    const timer = window.setTimeout(() => {
      resetSubmitHint();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [resetSubmitHint, shouldShowSubmitHint]);
}

