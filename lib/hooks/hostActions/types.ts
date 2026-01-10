import type { RoundStageEvent } from "@/lib/hooks/useRoundTimeline";
import type {
  ShowtimeIntentHandlers,
  ShowtimeIntentMetadata,
} from "@/lib/showtime/types";
import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";

export type QuickStartOptions = {
  broadcast?: boolean;
  playSound?: boolean;
  markShowtimeStart?: boolean;
  intentMeta?: ShowtimeIntentMetadata;
};

export type ResetOptions = {
  showFeedback?: boolean;
  playSound?: boolean;
  includeOnline?: boolean;
  recallSpectators?: boolean;
};

export type HostActionFeedback =
  | { message: string; tone: "info" | "success" }
  | null;

export type HostActionsLocalState = {
  quickStartPending: boolean;
  setQuickStartPending: Dispatch<SetStateAction<boolean>>;
  isResetting: boolean;
  setIsResetting: Dispatch<SetStateAction<boolean>>;
  isRestarting: boolean;
  setIsRestarting: Dispatch<SetStateAction<boolean>>;
  customOpen: boolean;
  setCustomOpen: Dispatch<SetStateAction<boolean>>;
  customStartPending: boolean;
  setCustomStartPending: Dispatch<SetStateAction<boolean>>;
  customText: string;
  setCustomText: Dispatch<SetStateAction<string>>;
  evalSortedPending: boolean;
  setEvalSortedPending: Dispatch<SetStateAction<boolean>>;
  evalSortedPendingRef: MutableRefObject<boolean>;
};

export type UseHostActionsOptions = {
  roomId: string;
  roomStatus?: string;
  statusVersion?: number | null;
  isHost: boolean;
  isRevealAnimating: boolean;
  autoStartLocked: boolean;
  beginAutoStartLock: (
    duration: number,
    options?: { broadcast?: boolean; delayMs?: number }
  ) => void;
  clearAutoStartLock: () => void;
  actualResolveMode: "sort-submit";
  defaultTopicType?: string | null;
  roundIds?: string[] | null;
  onlineUids?: string[] | null | undefined;
  proposal?: (string | null)[] | null;
  currentTopic?: string | null;
  onFeedback?: (payload: HostActionFeedback) => void;
  presenceReady?: boolean;
  presenceDegraded?: boolean;
  playerCount?: number;
  showtimeIntents?: ShowtimeIntentHandlers;
  onStageEvent?: (event: RoundStageEvent) => void;
};

