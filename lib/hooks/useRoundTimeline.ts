import { useCallback, useState } from "react";

export type RoundStage = "idle" | "resetting" | "preparing" | "starting";

export type RoundStageEvent =
  | "reset:start"
  | "reset:done"
  | "round:prepare"
  | "round:start"
  | "round:end"
  | "round:abort";

type UseRoundTimelineResult = {
  stage: RoundStage;
  showSpinner: boolean;
  spinnerText: string;
  emit: (event: RoundStageEvent) => void;
  reset: () => void;
};

export function useRoundTimeline(
  initialStage: RoundStage = "idle"
): UseRoundTimelineResult {
  const [stage, setStage] = useState<RoundStage>(initialStage);

  const emit = useCallback((event: RoundStageEvent) => {
    setStage((prev) => {
      switch (event) {
        case "reset:start":
          return "resetting";
        case "reset:done":
          return "idle";
        case "round:prepare":
          return "preparing";
        case "round:start":
          return "starting";
        case "round:end":
          return "idle";
        case "round:abort":
          return "idle";
        default:
          return prev;
      }
    });
  }, []);

  const reset = useCallback(() => setStage("idle"), []);

  const showSpinner = stage === "preparing" || stage === "starting";
  const spinnerText = "カードを配布しています…";

  return { stage, showSpinner, spinnerText, emit, reset };
}
