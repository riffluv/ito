import { gsap } from "gsap";
import { useEffect, type RefObject } from "react";
import type { SheetState } from "@/components/ui/mobile-bottom-sheet/types";

type Params = {
  sheetState: SheetState;
  prefersReduced: boolean;
  getSheetOffset: (target: SheetState) => number;
  animateSheet: (target: SheetState) => void;
  animateOverlay: (show: boolean) => void;
  animateContent: () => void;
  sheetRef: RefObject<HTMLDivElement>;
  overlayRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
};

export function useMobileBottomSheetAnimations({
  sheetState,
  prefersReduced,
  getSheetOffset,
  animateSheet,
  animateOverlay,
  animateContent,
  sheetRef,
  overlayRef,
  contentRef,
}: Params) {
  useEffect(() => {
    let contentTimer: number | undefined;

    if (prefersReduced) {
      if (sheetRef.current)
        gsap.set(sheetRef.current, {
          y: getSheetOffset(sheetState),
        });
      if (overlayRef.current)
        gsap.set(overlayRef.current, {
          opacity: sheetState === "full" ? 0.5 : 0,
          display: sheetState === "full" ? "block" : "none",
        });
      if (contentRef.current) gsap.set(contentRef.current, { opacity: 1, y: 0 });
    } else {
      animateSheet(sheetState);
      animateOverlay(sheetState === "full");
      if (sheetState !== "collapsed") {
        contentTimer = window.setTimeout(() => animateContent(), 100);
      }
    }

    return () => {
      if (contentTimer) {
        window.clearTimeout(contentTimer);
      }
    };
  }, [
    sheetState,
    prefersReduced,
    getSheetOffset,
    animateSheet,
    animateOverlay,
    animateContent,
    sheetRef,
    overlayRef,
    contentRef,
  ]);

  useEffect(() => {
    const sheetEl = sheetRef.current;
    const overlayEl = overlayRef.current;
    const contentEl = contentRef.current;

    if (sheetEl) {
      gsap.set(sheetEl, {
        y: getSheetOffset("collapsed"),
      });
    }
    if (overlayEl) {
      gsap.set(overlayEl, {
        opacity: 0,
        display: "none",
      });
    }

    return () => {
      try {
        if (sheetEl) {
          gsap.killTweensOf(sheetEl);
          gsap.set(sheetEl, {
            clearProps: "transform,opacity,x,y,scale",
          });
        }
        if (overlayEl) {
          gsap.killTweensOf(overlayEl);
          gsap.set(overlayEl, { clearProps: "opacity,display" });
        }
        if (contentEl) {
          gsap.killTweensOf(contentEl);
          gsap.set(contentEl, { clearProps: "opacity,y" });
        }
      } catch {
        // ignore
      }
    };
  }, [getSheetOffset, sheetRef, overlayRef, contentRef]);
}

