import { useDropHandler } from "@/components/hooks/useDropHandler";
import type { PlayerDoc } from "@/lib/types";
import type {
  Dispatch,
  DragEvent,
  MutableRefObject,
  SetStateAction,
} from "react";
import { useBoardPendingState } from "./useBoardPendingState";

type PendingState = (string | null)[];
type PendingStateUpdater = (updater: (prev: PendingState) => PendingState) => void;

export function useBoardDropState(params: {
  roomId: string;
  meId: string;
  me: (PlayerDoc & { id: string }) | undefined;
  roomStatus?: string;
  orderList?: string[];
  proposal?: (string | null)[];
  hasNumber: boolean;
  mePlaced: boolean;
  dealReady: boolean;
  dealGuardActive?: boolean;
  presenceReady?: boolean;
  interactionEnabled?: boolean;
}): {
  pending: PendingState;
  setPending: Dispatch<SetStateAction<PendingState>>;
  pendingRef: MutableRefObject<PendingState>;
  updatePendingState: PendingStateUpdater;
  isOver: boolean;
  setIsOver: Dispatch<SetStateAction<boolean>>;
  canDrop: boolean;
  onDropAtPosition: (e: DragEvent, index: number) => void;
  canDropAtPosition: (index: number) => boolean;
} {
  const {
    pending,
    setPending,
    isOver,
    setIsOver,
    canDrop,
    onDropAtPosition,
    canDropAtPosition,
  } = useDropHandler(params);

  const { pendingRef, updatePendingState } = useBoardPendingState({
    pending,
    setPending,
  });

  return {
    pending,
    setPending,
    pendingRef,
    updatePendingState,
    isOver,
    setIsOver,
    canDrop,
    onDropAtPosition,
    canDropAtPosition,
  };
}
