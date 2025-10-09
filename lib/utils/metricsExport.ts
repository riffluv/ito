"use client";

import { ItoMetrics, readMetrics, subscribeMetrics } from "@/lib/utils/metrics";

type MetricsPayload = {
  metrics: ItoMetrics;
  exportedAt: number;
  sessionId: string;
  page?: string;
};

const EXPORT_URL = process.env.NEXT_PUBLIC_METRICS_EXPORT_URL;
const EXPORT_INTERVAL = Number(process.env.NEXT_PUBLIC_METRICS_EXPORT_INTERVAL_MS || 15000);

let initialized = false;

function createSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function sendPayload(url: string, payload: MetricsPayload) {
  try {
    if (navigator?.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // ignore export failures to avoid cascading errors
  }
}

export function initMetricsExport() {
  if (initialized) return;
  if (typeof window === "undefined") return;
  if (!EXPORT_URL) return;
  initialized = true;
  const sessionId = createSessionId();

  let lastPayload: ItoMetrics = {};
  subscribeMetrics((snapshot) => {
    lastPayload = snapshot;
  });

  const flush = () => {
    const payload: MetricsPayload = {
      metrics: lastPayload,
      exportedAt: Date.now(),
      sessionId,
      page: typeof window !== "undefined" ? window.location.pathname : undefined,
    };
    sendPayload(EXPORT_URL, payload);
  };

  flush();
  window.setInterval(flush, Math.max(4000, EXPORT_INTERVAL));
}
