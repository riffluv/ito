import { useEffect } from "react";

export function useVictoryRaysPrefetch(): void {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_PIXI_RAYS === "0") return;
    void import("@/lib/pixi/victoryRays").catch((error) => {
      console.warn("[CentralCardBoard] prefetch victory rays failed", error);
    });
  }, []);
}

