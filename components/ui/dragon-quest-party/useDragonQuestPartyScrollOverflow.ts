import { useCallback, useEffect, useState, type RefObject } from "react";

type Params = {
  listContainerRef: RefObject<HTMLDivElement>;
  itemCount: number;
};

export function useDragonQuestPartyScrollOverflow({
  listContainerRef,
  itemCount,
}: Params) {
  const [enableScroll, setEnableScroll] = useState(false);

  const updateScrollOverflow = useCallback(() => {
    if (itemCount <= 6) {
      setEnableScroll(false);
      return;
    }
    const el = listContainerRef.current;
    if (!el) return;
    const tolerance = 12; // px
    const isOverflowing = el.scrollHeight - el.clientHeight > tolerance;
    setEnableScroll(isOverflowing);
  }, [itemCount, listContainerRef]);

  useEffect(() => {
    updateScrollOverflow();
    return undefined;
  }, [itemCount, updateScrollOverflow]);

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) {
      return undefined;
    }
    updateScrollOverflow();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => updateScrollOverflow());
      observer.observe(el);
    }
    const handleResize = () => updateScrollOverflow();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (observer) observer.disconnect();
    };
  }, [listContainerRef, updateScrollOverflow]);

  return { enableScroll };
}

