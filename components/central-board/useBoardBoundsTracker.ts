import { useCallback, useEffect, useRef, useState } from "react";

export function useBoardBoundsTracker() {
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const [boardElement, setBoardElement] = useState<HTMLDivElement | null>(null);
  const boardBoundsRef = useRef<DOMRect | null>(null);
  const dragActivationStartRef = useRef<number | null>(null);

  const updateBoardBounds = useCallback(() => {
    if (!boardContainerRef.current) return;
    boardBoundsRef.current = boardContainerRef.current.getBoundingClientRect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !boardElement) {
      return () => {};
    }
    updateBoardBounds();
    if (typeof ResizeObserver === "undefined") {
      return () => {};
    }
    const observer = new ResizeObserver(() => {
      updateBoardBounds();
    });
    observer.observe(boardElement);
    return () => {
      observer.disconnect();
    };
  }, [boardElement, updateBoardBounds]);

  const handleBoardRef = useCallback(
    (node: HTMLDivElement | null) => {
      boardContainerRef.current = node;
      setBoardElement(node);
      if (node) {
        updateBoardBounds();
      }
    },
    [updateBoardBounds]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !boardElement) {
      return () => {};
    }
    const handlePointerDown = () => {
      updateBoardBounds();
      if (typeof performance !== "undefined") {
        dragActivationStartRef.current = performance.now();
      }
    };
    const clearPointerClock = () => {
      dragActivationStartRef.current = null;
    };
    boardElement.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });
    window.addEventListener("pointerup", clearPointerClock);
    window.addEventListener("pointercancel", clearPointerClock);
    return () => {
      boardElement.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", clearPointerClock);
      window.removeEventListener("pointercancel", clearPointerClock);
    };
  }, [boardElement, updateBoardBounds]);

  return {
    boardContainerRef,
    boardBoundsRef,
    dragActivationStartRef,
    handleBoardRef,
    updateBoardBounds,
  };
}

