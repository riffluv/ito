import { useRef, useState } from "react";
import type { HostActionsLocalState } from "@/lib/hooks/hostActions/types";

export function useHostActionsLocalState(): HostActionsLocalState {
  const [quickStartPending, setQuickStartPending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customStartPending, setCustomStartPending] = useState(false);
  const [customText, setCustomText] = useState("");
  const [evalSortedPending, setEvalSortedPending] = useState(false);
  const evalSortedPendingRef = useRef(false);

  return {
    quickStartPending,
    setQuickStartPending,
    isResetting,
    setIsResetting,
    isRestarting,
    setIsRestarting,
    customOpen,
    setCustomOpen,
    customStartPending,
    setCustomStartPending,
    customText,
    setCustomText,
    evalSortedPending,
    setEvalSortedPending,
    evalSortedPendingRef,
  };
}

