"use client";

import { useEffect, useState } from "react";

export function useReducedMotionPreference() {
  const [shouldReduce, setShouldReduce] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updatePreference = () => {
      setShouldReduce(mediaQuery.matches);
    };

    updatePreference();

    const listener = (event: MediaQueryListEvent) => {
      setShouldReduce(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }

    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }, []);

  return shouldReduce;
}

export default useReducedMotionPreference;
