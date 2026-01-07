"use client";

import { useEffect, useState } from "react";

export function useRedirectGuard(delayMs = 1200) {
  const [redirectGuard, setRedirectGuard] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setRedirectGuard(false), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  return redirectGuard;
}

