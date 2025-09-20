"use client";

import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { useEffect, useMemo, useState } from "react";

type ReducedMotionOptions = {
  force?: boolean;
};

export function useReducedMotionPreference(options?: ReducedMotionOptions) {
  const { reducedMotion, forceAnimations } = useAnimationSettings();
  const target = useMemo(() => {
    if (options?.force) {
      return forceAnimations ? false : reducedMotion;
    }
    return reducedMotion;
  }, [options?.force, reducedMotion, forceAnimations]);

  const [shouldReduce, setShouldReduce] = useState(target);

  useEffect(() => {
    setShouldReduce(target);
  }, [target]);

  return shouldReduce;
}

export default useReducedMotionPreference;
