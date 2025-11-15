"use client";

import { ensureAuthSession } from "@/lib/firebase/authSession";
import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 18 * 60 * 1000; // 18分ごとにトークンを更新

export default function AuthSessionHeartbeat() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return () => {};
    }

    let timer: number | null = null;
    let disposed = false;

    const run = (reason: string) => {
      ensureAuthSession(reason).catch(() => void 0);
    };

    const schedule = () => {
      if (disposed) return;
      timer = window.setTimeout(() => {
        run("auth-heartbeat");
        schedule();
      }, HEARTBEAT_INTERVAL_MS);
    };

    run("auth-heartbeat-initial");
    schedule();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        run("auth-heartbeat-visibility");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
