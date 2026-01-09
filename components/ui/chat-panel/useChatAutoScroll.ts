import { useCallback, useEffect, useRef } from "react";

export function useChatAutoScroll(messageCount: number) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const pendingScrollFrameRef = useRef<number | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    if (pendingScrollFrameRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(pendingScrollFrameRef.current);
      pendingScrollFrameRef.current = null;
    }

    if (typeof window === "undefined") {
      scrollArea.scrollTop = scrollArea.scrollHeight;
      autoScrollRef.current = true;
      return;
    }

    pendingScrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior });
      pendingScrollFrameRef.current = null;
      autoScrollRef.current = true;
    });
  }, []);

  const handleScroll = useCallback(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    const distanceFromBottom =
      scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight;
    autoScrollRef.current = distanceFromBottom <= 120;
  }, []);

  useEffect(() => {
    return () => {
      if (pendingScrollFrameRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(pendingScrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const current = messageCount;
    const previous = lastMessageCountRef.current;
    const hasNewMessages = current > previous;
    const isInitialLoad = previous === 0 && current > 0;
    lastMessageCountRef.current = current;

    if (current === 0) return;

    if (isInitialLoad) {
      scrollToBottom("auto");
      return;
    }

    if (hasNewMessages && autoScrollRef.current) {
      scrollToBottom("smooth");
    }
  }, [messageCount, scrollToBottom]);

  return { scrollAreaRef, handleScroll };
}

