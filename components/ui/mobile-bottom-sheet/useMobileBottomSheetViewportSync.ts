import { gsap } from "gsap";
import { useEffect, useState, type RefObject } from "react";
import type { SheetState } from "@/components/ui/mobile-bottom-sheet/types";

type Params = {
  sheetRef: RefObject<HTMLDivElement>;
  sheetState: SheetState;
  getSheetOffset: (target: SheetState) => number;
};

export function useMobileBottomSheetViewportSync({
  sheetRef,
  sheetState,
  getSheetOffset,
}: Params) {
  const [, setViewportTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const handleViewportChange = () => {
      setViewportTick((tick) => tick + 1);
      if (sheetRef.current) {
        const y = getSheetOffset(sheetState);
        gsap.set(sheetRef.current, { y });
      }
    };
    viewport.addEventListener("resize", handleViewportChange);
    viewport.addEventListener("scroll", handleViewportChange);
    return () => {
      viewport.removeEventListener("resize", handleViewportChange);
      viewport.removeEventListener("scroll", handleViewportChange);
    };
  }, [getSheetOffset, sheetState, sheetRef]);
}

