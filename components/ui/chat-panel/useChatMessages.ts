import { db } from "@/lib/firebase/client";
import type { ChatDoc } from "@/lib/types";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import {
  collection,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useState } from "react";

export function useChatMessages(roomId: string) {
  const [messages, setMessages] = useState<(ChatDoc & { id: string })[]>([]);

  useEffect(() => {
    const q = query(
      collection(db!, "rooms", roomId, "chat"),
      orderBy("createdAt", "asc"),
      limitToLast(100)
    );

    const unsubRef = { current: null as null | (() => void) };
    const backoffUntilRef = { current: 0 };
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      if (unsubRef.current) {
        unsubRef.current();
      }
      unsubRef.current = null;
    };

    const maybeStart = () => {
      if (unsubRef.current) return;
      const now = Date.now();
      if (now < backoffUntilRef.current) return;
      unsubRef.current = onSnapshot(
        q,
        (snap) => {
          const list: (ChatDoc & { id: string })[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...(d.data() as ChatDoc) }));
          setMessages(list);
        },
        (err) => {
          if (isFirebaseQuotaExceeded(err)) {
            handleFirebaseQuotaError("チャット購読");
            backoffUntilRef.current = Date.now() + 5 * 60 * 1000;
            stop();
            if (backoffTimer) {
              clearTimeout(backoffTimer);
              backoffTimer = null;
            }
            const resume = () => {
              if (
                typeof document !== "undefined" &&
                document.visibilityState !== "visible"
              )
                return;
              const remain = backoffUntilRef.current - Date.now();
              if (remain > 0)
                backoffTimer = setTimeout(resume, Math.min(remain, 30_000));
              else maybeStart();
            };
            resume();
          }
        }
      );
    };

    if (typeof document === "undefined" || document.visibilityState === "visible") {
      maybeStart();
    }
    const onVis = () => {
      if (document.visibilityState === "visible") maybeStart();
      else stop();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
      if (backoffTimer) {
        clearTimeout(backoffTimer);
      }
      stop();
    };
  }, [roomId]);

  return messages;
}

