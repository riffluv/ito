"use client";

import { recordMetricDistribution } from "@/lib/perf/metricsClient";

type SafeUpdateTelemetryEvent =
  | "triggered"
  | "applied"
  | "suppressed"
  | "no_waiting"
  | "failure";

export type SafeUpdateTelemetryOptions = {
  reason?: string;
  safeMode?: boolean;
  detail?: string;
  appVersion?: string;
  waitingVersion?: string;
  requiredSwVersion?: string;
};

type SentryGlobal = {
  captureMessage?: (message: string, context?: Record<string, unknown>) => void;
};

const EVENT_METRIC_MAP: Record<SafeUpdateTelemetryEvent, string> = {
  triggered: "safe_update.triggered",
  applied: "safe_update.applied",
  suppressed: "safe_update.suppressed",
  no_waiting: "safe_update.no_waiting",
  failure: "safe_update.failure",
};

const EVENT_SEVERITY: Record<SafeUpdateTelemetryEvent, "info" | "warning"> = {
  triggered: "info",
  applied: "info",
  suppressed: "warning",
  no_waiting: "info",
  failure: "warning",
};

function getSentryGlobal(): SentryGlobal | null {
  const globalScope = globalThis as typeof globalThis & { Sentry?: SentryGlobal };
  return globalScope.Sentry ?? null;
}

function toTags(options?: SafeUpdateTelemetryOptions): Record<string, string> | undefined {
  if (!options) return undefined;
  const tags: Record<string, string> = {};
  if (typeof options.reason === "string" && options.reason.length > 0) {
    tags.reason = options.reason.slice(0, 80);
  }
  if (typeof options.detail === "string" && options.detail.length > 0) {
    tags.detail = options.detail.slice(0, 80);
  }
  if (typeof options.safeMode === "boolean") {
    tags.safeMode = options.safeMode ? "1" : "0";
  }
  if (typeof options.appVersion === "string" && options.appVersion.length > 0) {
    tags.appVersion = options.appVersion.slice(0, 80);
  }
  if (typeof options.waitingVersion === "string" && options.waitingVersion.length > 0) {
    tags.waitingVersion = options.waitingVersion.slice(0, 80);
  }
  if (typeof options.requiredSwVersion === "string" && options.requiredSwVersion.length > 0) {
    tags.requiredSwVersion = options.requiredSwVersion.slice(0, 80);
  }
  return Object.keys(tags).length > 0 ? tags : undefined;
}

export function logSafeUpdateTelemetry(
  event: SafeUpdateTelemetryEvent,
  options?: SafeUpdateTelemetryOptions
): void {
  try {
    const metricName = EVENT_METRIC_MAP[event];
    if (metricName) {
      recordMetricDistribution(metricName, 1, toTags(options));
    }

    const sentry = getSentryGlobal();
    if (sentry?.captureMessage) {
      const level = EVENT_SEVERITY[event];
      sentry.captureMessage(`[safe-update] ${event}`, {
        level,
        extra: {
          reason: options?.reason,
          detail: options?.detail,
          safeMode: options?.safeMode ?? null,
          appVersion: options?.appVersion ?? null,
          waitingVersion: options?.waitingVersion ?? null,
          requiredSwVersion: options?.requiredSwVersion ?? null,
        },
      });
    }

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(`[safe-update:${event}]`, options ?? {});
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[safe-update] telemetry dispatch failed", error);
    }
  }
}
