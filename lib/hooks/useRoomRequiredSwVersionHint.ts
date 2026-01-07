"use client";

import { setRequiredSwVersionHint } from "@/lib/serviceWorker/updateChannel";
import { setMetric } from "@/lib/utils/metrics";
import { useEffect, useMemo } from "react";

export function useRoomRequiredSwVersionHint(requiredSwVersionRaw: unknown): string {
  const requiredSwVersion = useMemo(() => {
    const raw = typeof requiredSwVersionRaw === "string" ? requiredSwVersionRaw : "";
    return raw.trim();
  }, [requiredSwVersionRaw]);

  useEffect(() => {
    if (requiredSwVersion) {
      setMetric("app", "requiredSwVersion", requiredSwVersion);
    } else {
      setMetric("app", "requiredSwVersion", "");
    }
    setMetric("app", "versionMismatch", 0);
  }, [requiredSwVersion]);

  useEffect(() => {
    // NOTE: `requiredSwVersion` は過去の PWA/Safe Update 用フィールド（運用上は外部で書かれる場合がある）。
    // ルーム参加/操作の Version Contract は `room.appVersion` + server guard を唯一の真実とし、
    // ここで `requiredSwVersion` によって入室/操作をブロックしない（混同による誤案内を防ぐ）。
    setRequiredSwVersionHint(requiredSwVersion || null);
  }, [requiredSwVersion]);

  useEffect(() => {
    return () => {
      setRequiredSwVersionHint(null);
    };
  }, []);

  return requiredSwVersion;
}

