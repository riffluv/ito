import { useMemo } from "react";
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import type { PointerProfile } from "@/lib/hooks/usePointerProfile";

export function useBoardDragSensors(params: {
  pointerProfile: PointerProfile;
  dragBoostEnabled: boolean;
}) {
  const { pointerProfile, dragBoostEnabled } = params;

  const mouseSensorOptions = useMemo(
    () => ({
      activationConstraint: {
        // Avoid accidental micro-drags on desktop (which can momentarily hide the card)
        // while keeping touch devices responsive.
        distance: (() => {
          const base = pointerProfile.isCoarsePointer ? 6 : 4;
          // "Boost" keeps activation snappy but should not be hair-trigger.
          return dragBoostEnabled ? Math.max(2, Math.round(base * 0.5)) : base;
        })(),
      },
    }),
    [pointerProfile.isCoarsePointer, dragBoostEnabled]
  );

  const touchSensorOptions = useMemo(() => {
    const base = pointerProfile.isTouchOnly
      ? {
          delay: 45,
          tolerance: 26,
        }
      : {
          delay: 160,
          tolerance: 8,
        };
    if (!dragBoostEnabled) {
      return { activationConstraint: base };
    }
    return {
      activationConstraint: {
        delay: Math.max(12, Math.round(base.delay * 0.35)),
        tolerance: base.tolerance + 6,
      },
    };
  }, [pointerProfile.isTouchOnly, dragBoostEnabled]);

  const sensors = useSensors(
    useSensor(MouseSensor, mouseSensorOptions),
    useSensor(TouchSensor, touchSensorOptions),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return { sensors };
}

