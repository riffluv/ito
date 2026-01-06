"use client";

import { usePointerProfile } from "@/lib/hooks/usePointerProfile";
import { useSupportToolsEnabled } from "@/lib/hooks/useSupportToolsEnabled";

export function useCentralCardBoardInteractionProfile(): {
  pointerProfile: ReturnType<typeof usePointerProfile>;
  dropDebugEnabled: boolean;
} {
  const pointerProfile = usePointerProfile();
  const supportToolsEnabled = useSupportToolsEnabled();
  const dropDebugEnabled =
    process.env.NEXT_PUBLIC_UI_DROP_DEBUG === "1" || supportToolsEnabled;

  return { pointerProfile, dropDebugEnabled };
}

