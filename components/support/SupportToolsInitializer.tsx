"use client";

import { useEffect } from "react";
import { useSupportToolsEnabled } from "@/lib/hooks/useSupportToolsEnabled";

type SupportWindow = typeof window & {
  __ITO_SUPPORT_TOOLS_ENABLED__?: boolean;
};

export default function SupportToolsInitializer() {
  const enabled = useSupportToolsEnabled();

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as SupportWindow).__ITO_SUPPORT_TOOLS_ENABLED__ = enabled;
  }, [enabled]);

  return null;
}

