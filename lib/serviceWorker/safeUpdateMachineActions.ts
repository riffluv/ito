import { logSafeUpdateTelemetry } from "@/lib/telemetry/safeUpdate";
import { traceAction, traceError } from "@/lib/utils/trace";
import { assign, type ActionArgs, type AnyEventObject } from "xstate";

import {
  buildTelemetryOptions,
  hasForceHold,
  type SafeUpdateContext,
  type SafeUpdateEvent,
  type StartApplyFn,
} from "./safeUpdateModel";
import {
  APPLY_TIMEOUT_MS,
  AUTO_APPLY_DELAY_MS,
  AUTO_APPLY_REASON,
  extractVersionTag,
} from "./safeUpdateMachineHelpers";

export function createSafeUpdateActions(params: {
  now: () => number;
  broadcast: { postMessage: (message: unknown) => void } | null;
  isBrowser: boolean;
  startApply: StartApplyFn;
}) {
  const { now, broadcast, isBrowser, startApply } = params;
  const assignSafeUpdate = assign<
    SafeUpdateContext,
    AnyEventObject,
    undefined,
    SafeUpdateEvent,
    never
  >;

  return {
    setCheckStart: assignSafeUpdate(({ event }) => {
      if (event.type !== "CHECK_STARTED") return {};
      return { lastCheckAt: event.timestamp };
    }),
    setCheckFailure: assignSafeUpdate(({ event }) => {
      if (event.type !== "CHECK_FAILED") return {};
      return { lastError: event.detail };
    }),
    storeWaiting: assignSafeUpdate(({ context, event }) => {
      if (event.type !== "WAITING_DETECTED") return {};
      return {
        waitingRegistration: event.registration,
        waitingVersion: extractVersionTag(event.registration),
        waitingSince: context.waitingSince ?? now(),
        lastError: null,
      };
    }),
    clearWaiting: assignSafeUpdate(() => ({
      waitingRegistration: null,
      waitingVersion: null,
      waitingSince: null,
      autoApplyAt: null,
      autoApplyTimerId: null,
      autoApplySuppressed: false,
      autoApplyHolds: {},
    })),
    queueEvaluateReady: ({ context, self }: ActionArgs<
      SafeUpdateContext,
      AnyEventObject,
      SafeUpdateEvent
    >) => {
      if (!context.waitingRegistration?.waiting) {
        self.send({ type: "READY_MANUAL" });
        return;
      }
      if (context.autoApplySuppressed || hasForceHold(context.autoApplyHolds)) {
        self.send({ type: "READY_SUPPRESSED" });
        return;
      }
      self.send({ type: "READY_AUTO" });
    },
    setAutoSuppressed: assignSafeUpdate(({ context }) => {
      if (context.autoApplySuppressed) return {};
      traceAction("safeUpdate.autoApply.suppressed");
      return { autoApplySuppressed: true };
    }),
    clearAutoSuppressed: assignSafeUpdate(({ context }) => {
      if (!context.autoApplySuppressed) return {};
      traceAction("safeUpdate.autoApply.resumed");
      return { autoApplySuppressed: false };
    }),
    addForceHold: assignSafeUpdate(({ context, event }) => {
      if (event.type !== "FORCE_HOLD") return {};
      const holds = { ...context.autoApplyHolds };
      holds[event.key] = (holds[event.key] ?? 0) + 1;
      return { autoApplyHolds: holds };
    }),
    releaseForceHold: assignSafeUpdate(({ context, event }) => {
      if (event.type !== "FORCE_RELEASE") return {};
      const holds = { ...context.autoApplyHolds };
      const current = holds[event.key] ?? 0;
      if (current <= 1) {
        delete holds[event.key];
      } else {
        holds[event.key] = current - 1;
      }
      return { autoApplyHolds: holds };
    }),
    scheduleAutoApplyTimer: assignSafeUpdate(({ context, self }) => {
      if (!isBrowser || !context.waitingRegistration?.waiting) {
        return { autoApplyAt: null, autoApplyTimerId: null };
      }
      if (context.autoApplyTimerId !== null) {
        window.clearTimeout(context.autoApplyTimerId);
      }
      const targetAt = now() + AUTO_APPLY_DELAY_MS;
      const timerId = window.setTimeout(() => {
        self.send({ type: "AUTO_TIMER_EXPIRED" });
      }, AUTO_APPLY_DELAY_MS);
      traceAction("safeUpdate.autoApply.scheduled", { delayMs: AUTO_APPLY_DELAY_MS });
      return { autoApplyAt: targetAt, autoApplyTimerId: timerId };
    }),
    clearAutoApplyTimer: assignSafeUpdate(({ context }) => {
      if (isBrowser && context.autoApplyTimerId !== null) {
        window.clearTimeout(context.autoApplyTimerId);
      }
      return { autoApplyTimerId: null, autoApplyAt: null };
    }),
    scheduleApplyTimeout: assignSafeUpdate(({ context, self }) => {
      if (!isBrowser) {
        return { applyTimeoutId: null };
      }
      if (context.applyTimeoutId !== null) {
        window.clearTimeout(context.applyTimeoutId);
      }
      const timeoutId = window.setTimeout(() => {
        self.send({ type: "APPLY_TIMEOUT" });
      }, APPLY_TIMEOUT_MS);
      return { applyTimeoutId: timeoutId };
    }),
    clearApplyTimeout: assignSafeUpdate(({ context }) => {
      if (isBrowser && context.applyTimeoutId !== null) {
        window.clearTimeout(context.applyTimeoutId);
      }
      return { applyTimeoutId: null };
    }),
    startManualApplying: assignSafeUpdate(({ context, event }) => {
      if (event.type !== "APPLY_REQUEST" && event.type !== "RETRY") {
        return {};
      }
      return startApply(context, {
        reason: event.reason,
        safeMode: event.safeMode,
        automatic: event.automatic,
        broadcast: true,
      });
    }),
    startAutoApplying: assignSafeUpdate(({ context }) =>
      startApply(context, {
        reason: AUTO_APPLY_REASON,
        safeMode: false,
        automatic: true,
        broadcast: true,
      })
    ),
    startRetryApplying: assignSafeUpdate(({ context, event }) => {
      if (event.type !== "RETRY") return {};
      return startApply(context, {
        reason: event.reason,
        safeMode: event.safeMode,
        automatic: event.automatic,
        broadcast: true,
      });
    }),
    handleApplySuccess: assignSafeUpdate(({ context, event }) => {
      const pending = context.pendingApply;
      const reason = pending?.reason ?? "manual";
      const safeMode = pending?.safeMode ?? false;
      logSafeUpdateTelemetry("applied", buildTelemetryOptions(context, { reason, safeMode }));
      traceAction("safeUpdate.apply.success", {
        reason,
        safeMode,
        attemptId: pending?.attemptId ?? null,
      });
      if (event.type === "APPLY_SUCCESS" ? event.broadcast !== false : true) {
        broadcast?.postMessage({ type: "update-applied" });
      }
      return {
        pendingApply: null,
        retryCount: 0,
        lastError: null,
        pendingReload: true,
      };
    }),
    handleApplyFailure: assignSafeUpdate(({ context, event }) => {
      if (event.type !== "APPLY_FAILURE") return {};
      const detail = event.detail ?? "unknown";
      const reason = event.reason ?? context.pendingApply?.reason ?? "manual";
      const safeMode = event.safeMode ?? context.pendingApply?.safeMode ?? false;
      logSafeUpdateTelemetry(
        "failure",
        buildTelemetryOptions(context, { reason, safeMode, detail })
      );
      traceError("safeUpdate.apply.failed", detail, {
        reason,
        safeMode,
        attemptId: context.pendingApply?.attemptId ?? null,
      });
      if (event.broadcast !== false) {
        broadcast?.postMessage({ type: "update-failed", detail });
      }
      return {
        pendingApply: null,
        pendingReload: false,
        lastError: detail,
      };
    }),
    handleApplyTimeout: assignSafeUpdate(({ context }) => {
      const reason = context.pendingApply?.reason ?? AUTO_APPLY_REASON;
      const safeMode = context.pendingApply?.safeMode ?? false;
      logSafeUpdateTelemetry(
        "failure",
        buildTelemetryOptions(context, { reason, safeMode, detail: "timeout" })
      );
      traceError("safeUpdate.apply.timeout", "timeout", {
        reason,
        safeMode,
        attemptId: context.pendingApply?.attemptId ?? null,
      });
      broadcast?.postMessage({ type: "update-failed", detail: "timeout" });
      return {
        pendingApply: null,
        pendingReload: false,
        lastError: "timeout",
      };
    }),
    handleApplyRedundant: assignSafeUpdate(({ context }) => {
      const reason = context.pendingApply?.reason ?? "manual";
      const safeMode = context.pendingApply?.safeMode ?? false;
      logSafeUpdateTelemetry(
        "failure",
        buildTelemetryOptions(context, { reason, safeMode, detail: "redundant" })
      );
      traceError("safeUpdate.apply.redundant", "redundant", {
        reason,
        safeMode,
        attemptId: context.pendingApply?.attemptId ?? null,
      });
      broadcast?.postMessage({ type: "update-failed", detail: "redundant" });
      return {
        pendingApply: null,
        pendingReload: false,
        lastError: "redundant",
      };
    }),
    noWaitingFailure: assignSafeUpdate(({ context, event }) => {
      const reason =
        event.type === "APPLY_REQUEST" || event.type === "RETRY"
          ? event.reason
          : event.type === "AUTO_TIMER_EXPIRED"
            ? AUTO_APPLY_REASON
            : "manual";
      logSafeUpdateTelemetry("no_waiting", buildTelemetryOptions(context, { reason }));
      return {
        lastError: "no_waiting",
        pendingReload: false,
        applyReason: reason,
      };
    }),
    incrementRetry: assignSafeUpdate(({ context }) => ({
      retryCount: context.retryCount + 1,
    })),
    resetRetry: assignSafeUpdate(() => ({ retryCount: 0 })),
    consumePendingReload: assignSafeUpdate(() => ({ pendingReload: false })),
    consumePendingApply: assignSafeUpdate(() => ({ pendingApply: null, applyReason: null })),
    announceWaiting: ({ event }: ActionArgs<SafeUpdateContext, AnyEventObject, SafeUpdateEvent>) => {
      if (event.type !== "WAITING_DETECTED") return;
      if (event.broadcast === false) return;
      broadcast?.postMessage({ type: "update-ready", source: event.source });
    },
    announceCleared: ({ event }: ActionArgs<SafeUpdateContext, AnyEventObject, SafeUpdateEvent>) => {
      if (event.type !== "WAITING_CLEARED") return;
      if (event.broadcast === false) return;
      broadcast?.postMessage({ type: "update-cleared", source: event.source });
    },
    announceSuppressed: ({ event }: ActionArgs<SafeUpdateContext, AnyEventObject, SafeUpdateEvent>) => {
      if (event.type !== "AUTO_SUPPRESS") return;
      if (event.broadcast === false) return;
      broadcast?.postMessage({ type: "suppress" });
    },
    announceResume: ({ event }: ActionArgs<SafeUpdateContext, AnyEventObject, SafeUpdateEvent>) => {
      if (event.type !== "AUTO_RESUME") return;
      if (event.broadcast === false) return;
      broadcast?.postMessage({ type: "resume-auto" });
    },
    announceForceHold: ({ event }: ActionArgs<SafeUpdateContext, AnyEventObject, SafeUpdateEvent>) => {
      if (event.type !== "FORCE_HOLD") return;
      if (event.broadcast === false) return;
      broadcast?.postMessage({ type: "force-hold", detail: event.key });
    },
    announceForceRelease: ({ event }: ActionArgs<
      SafeUpdateContext,
      AnyEventObject,
      SafeUpdateEvent
    >) => {
      if (event.type !== "FORCE_RELEASE") return;
      if (event.broadcast === false) return;
      broadcast?.postMessage({ type: "force-release", detail: event.key });
    },
  } as const;
}
