"use client";

import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { useEffect, useState } from "react";

export function useReducedMotionPreference() {
  const { reducedMotion } = useAnimationSettings();
  const [shouldReduce, setShouldReduce] = useState(reducedMotion);

  useEffect(() => {
    setShouldReduce(reducedMotion);
  }, [reducedMotion]);

  return shouldReduce;
}

export default useReducedMotionPreference;
