import { traceAction } from "@/lib/utils/trace";

export function closeCustomTopic(params: {
  roomId: string;
  isHost: boolean;
  setCustomOpen: (open: boolean) => void;
  setCustomStartPending: (pending: boolean) => void;
  clearAutoStartLock: () => void;
  onFeedback?: (payload: { message: string; tone: "info" | "success" } | null) => void;
}): void {
  const {
    roomId,
    isHost,
    setCustomOpen,
    setCustomStartPending,
    clearAutoStartLock,
    onFeedback,
  } = params;

  setCustomOpen(false);
  setCustomStartPending(false);
  clearAutoStartLock();
  onFeedback?.(null);
  traceAction("ui.topic.customClose", {
    roomId,
    isHost: isHost ? "1" : "0",
  });
}

