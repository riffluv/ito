import { gsap } from "gsap";
import { useEffect, type MutableRefObject, type RefObject } from "react";

type Params = {
  isOpen: boolean;
  prefersReduced: boolean;
  overlayRef: RefObject<HTMLDivElement>;
  boardRef: RefObject<HTMLDivElement>;
  rowRefs: MutableRefObject<HTMLDivElement[]>;
};

export function useMvpLedgerOpenAnimation({
  isOpen,
  prefersReduced,
  overlayRef,
  boardRef,
  rowRefs,
}: Params) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const overlay = overlayRef.current;
    const board = boardRef.current;
    if (!overlay || !board) return undefined;

    const rows = rowRefs.current.filter(Boolean);

    if (prefersReduced) {
      gsap.set(overlay, { opacity: 1 });
      gsap.set(board, { opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 });
      rows.forEach((row) => gsap.set(row, { opacity: 1, y: 0 }));
      return undefined;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        overlay,
        { opacity: 0 },
        { opacity: 1, duration: 0.18, ease: "power2.in" }
      );

      gsap.fromTo(
        board,
        {
          opacity: 0,
          x: 150,
          y: -20,
          scale: 0.88,
          rotation: 8,
        },
        {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          duration: 0.52,
          ease: "back.out(1.8)",
        }
      );
    }, board);
    return () => ctx.revert();
  }, [isOpen, prefersReduced, overlayRef, boardRef, rowRefs]);
}
