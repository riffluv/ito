"use client";

import { recordMetricDistribution } from "@/lib/perf/metricsClient";

type OpsLevel = "info" | "warning" | "error";

type SentryGlobal = {
  captureMessage?: (
    message: string,
    context?: { level?: OpsLevel; extra?: Record<string, unknown> }
  ) => void;
};

type OpsEventPayload = {
  name: string;
  metric: string;
  level?: OpsLevel;
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
};

function getSentryGlobal(): SentryGlobal | null {
  const globalScope = globalThis as typeof globalThis & { Sentry?: SentryGlobal };
  return globalScope.Sentry ?? null;
}

function sanitizeTags(
  tags?: Record<string, string | number | boolean | null | undefined>
): Record<string, string> | undefined {
  if (!tags) return undefined;
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (value === null || value === undefined) continue;
    const text =
      typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : "";
    if (!text) continue;
    sanitized[key] = text.slice(0, 80);
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function reportOpsEvent({
  name,
  metric,
  level = "info",
  tags,
  extra,
}: OpsEventPayload): void {
  try {
    recordMetricDistribution(metric, 1, sanitizeTags(tags));
    const sentry = getSentryGlobal();
    sentry?.captureMessage?.(`[ops] ${name}`, {
      level,
      extra,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[ops] telemetry dispatch failed", error);
    }
  }
}
