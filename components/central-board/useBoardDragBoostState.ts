import {
  useEffect,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { RoomDoc } from "@/lib/types";
import { setMetric } from "@/lib/utils/metrics";

export function useBoardDragBoostState(params: {
  roomStatus: RoomDoc["status"];
  dragActivationStartRef: MutableRefObject<number | null>;
}): {
  dragBoostEnabled: boolean;
  setDragBoostEnabled: Dispatch<SetStateAction<boolean>>;
} {
  const { roomStatus, dragActivationStartRef } = params;

  const [dragBoostEnabled, setDragBoostEnabled] = useState(false);

  useEffect(() => {
    if (roomStatus !== "clue" && dragBoostEnabled) {
      setDragBoostEnabled(false);
      dragActivationStartRef.current = null;
    }
  }, [roomStatus, dragBoostEnabled, dragActivationStartRef]);

  useEffect(() => {
    setMetric("drag", "boostEnabled", dragBoostEnabled ? 1 : 0);
  }, [dragBoostEnabled]);

  return { dragBoostEnabled, setDragBoostEnabled };
}

