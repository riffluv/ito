import { logSafeUpdateTelemetry } from "@/lib/telemetry/safeUpdate";
import { traceAction, traceError } from "@/lib/utils/trace";
import { assign, setup } from "xstate";

import {
  buildTelemetryOptions,
  createInitialContext,
  hasForceHold,
  type SafeUpdateContext,
  type SafeUpdateEvent,
  type SafeUpdateMachineDeps,
} from "./safeUpdateModel";
export {
  buildTelemetryOptions,
  createInitialContext,
  getRequiredSwVersionHint,
  hasForceHold,
  normalizeHoldReason,
  setRequiredSwVersionHint,
} from "./safeUpdateModel";
export type {
  ApplyServiceWorkerOptions,
  ClearResult,
  SafeUpdateContext,
  SafeUpdateEvent,
  SafeUpdateMachineDeps,
  SafeUpdatePhase,
  SafeUpdateSnapshot,
  StartApplyFn,
} from "./safeUpdateModel";

function extractVersionTag(registration: ServiceWorkerRegistration): string | null {
  const candidate =
    registration.waiting ?? registration.installing ?? registration.active ?? null;
  if (!candidate) {
    return null;
  }
  try {
    const url = new URL(candidate.scriptURL);
    return url.searchParams.get("v");
  } catch {
    return null;
  }
}

// Applying an update can take longer than expected when large caches are being purged during SW activation
// or when a hard-reload fallback is in-flight on slow devices/networks.
const APPLY_TIMEOUT_MS = 45_000;
// Shorten auto-apply window to reduce time users can stay on an old build.
const AUTO_APPLY_DELAY_MS = 15_000;
const AUTO_APPLY_REASON = "auto-timer";

export function createSafeUpdateMachine(deps: SafeUpdateMachineDeps) {
  const now = deps.now ?? (() => Date.now());
  const broadcast = deps.broadcast;
  const isBrowser = deps.isBrowser;
  const startApply = deps.startApply;

  return setup({
    types: {
      context: {} as SafeUpdateContext,
      events: {} as SafeUpdateEvent,
    },
    guards: {
      hasWaiting: ({ context }) => Boolean(context.waitingRegistration?.waiting),
      clearResultActivated: ({ event }: { event: SafeUpdateEvent }) =>
        event.type === "WAITING_CLEARED" && event.result === "activated",
      clearResultRedundant: ({ event }: { event: SafeUpdateEvent }) =>
        event.type === "WAITING_CLEARED" && event.result === "redundant",
      isSuppressed: ({ context }) =>
        context.autoApplySuppressed || hasForceHold(context.autoApplyHolds),
    },
    actions: {
      setCheckStart: assign(({ event }) => {
        if (event.type !== "CHECK_STARTED") return {};
        return { lastCheckAt: event.timestamp };
      }),
      setCheckFailure: assign(({ event }) => {
        if (event.type !== "CHECK_FAILED") return {};
        return { lastError: event.detail };
      }),
      storeWaiting: assign(({ context, event }) => {
        if (event.type !== "WAITING_DETECTED") return {};
        return {
          waitingRegistration: event.registration,
          waitingVersion: extractVersionTag(event.registration),
          waitingSince: context.waitingSince ?? now(),
          lastError: null,
        };
      }),
      clearWaiting: assign(() => ({
        waitingRegistration: null,
        waitingVersion: null,
        waitingSince: null,
        autoApplyAt: null,
        autoApplyTimerId: null,
        autoApplySuppressed: false,
        autoApplyHolds: {},
      })),
      queueEvaluateReady: ({ context, self }) => {
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
      setAutoSuppressed: assign(({ context }) => {
        if (context.autoApplySuppressed) return {};
        traceAction("safeUpdate.autoApply.suppressed");
        return { autoApplySuppressed: true };
      }),
      clearAutoSuppressed: assign(({ context }) => {
        if (!context.autoApplySuppressed) return {};
        traceAction("safeUpdate.autoApply.resumed");
        return { autoApplySuppressed: false };
      }),
      addForceHold: assign(({ context, event }) => {
        if (event.type !== "FORCE_HOLD") return {};
        const holds = { ...context.autoApplyHolds };
        holds[event.key] = (holds[event.key] ?? 0) + 1;
        return { autoApplyHolds: holds };
      }),
      releaseForceHold: assign(({ context, event }) => {
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
      scheduleAutoApplyTimer: assign(({ context, self }) => {
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
      clearAutoApplyTimer: assign(({ context }) => {
        if (isBrowser && context.autoApplyTimerId !== null) {
          window.clearTimeout(context.autoApplyTimerId);
        }
        return { autoApplyTimerId: null, autoApplyAt: null };
      }),
      scheduleApplyTimeout: assign(({ context, self }) => {
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
      clearApplyTimeout: assign(({ context }) => {
        if (isBrowser && context.applyTimeoutId !== null) {
          window.clearTimeout(context.applyTimeoutId);
        }
        return { applyTimeoutId: null };
      }),
      startManualApplying: assign(({ context, event }) => {
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
      startAutoApplying: assign(({ context }) =>
        startApply(context, {
          reason: AUTO_APPLY_REASON,
          safeMode: false,
          automatic: true,
          broadcast: true,
        })
      ),
      startRetryApplying: assign(({ context, event }) => {
        if (event.type !== "RETRY") return {};
        return startApply(context, {
          reason: event.reason,
          safeMode: event.safeMode,
          automatic: event.automatic,
          broadcast: true,
        });
      }),
      handleApplySuccess: assign(({ context, event }) => {
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
      handleApplyFailure: assign(({ context, event }) => {
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
      handleApplyTimeout: assign(({ context }) => {
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
      handleApplyRedundant: assign(({ context }) => {
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
      noWaitingFailure: assign(({ context, event }) => {
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
      incrementRetry: assign(({ context }) => ({
        retryCount: context.retryCount + 1,
      })),
      resetRetry: assign(() => ({ retryCount: 0 })),
      consumePendingReload: assign(() => ({ pendingReload: false })),
      consumePendingApply: assign(() => ({ pendingApply: null, applyReason: null })),
      announceWaiting: ({ event }) => {
        if (event.type !== "WAITING_DETECTED") return;
        if (event.broadcast === false) return;
        broadcast?.postMessage({ type: "update-ready", source: event.source });
      },
      announceCleared: ({ event }) => {
        if (event.type !== "WAITING_CLEARED") return;
        if (event.broadcast === false) return;
        broadcast?.postMessage({ type: "update-cleared", source: event.source });
      },
      announceSuppressed: ({ event }) => {
        if (event.type !== "AUTO_SUPPRESS") return;
        if (event.broadcast === false) return;
        broadcast?.postMessage({ type: "suppress" });
      },
      announceResume: ({ event }) => {
        if (event.type !== "AUTO_RESUME") return;
        if (event.broadcast === false) return;
        broadcast?.postMessage({ type: "resume-auto" });
      },
      announceForceHold: ({ event }) => {
        if (event.type !== "FORCE_HOLD") return;
        if (event.broadcast === false) return;
        broadcast?.postMessage({ type: "force-hold", detail: event.key });
      },
      announceForceRelease: ({ event }) => {
        if (event.type !== "FORCE_RELEASE") return;
        if (event.broadcast === false) return;
        broadcast?.postMessage({ type: "force-release", detail: event.key });
      },
    },
  }).createMachine({
    id: "safeUpdate",
    initial: "idle",
    context: createInitialContext(),
    on: {
      RELOAD_CONSUMED: { actions: "consumePendingReload" },
      PENDING_APPLY_CONSUMED: { actions: "consumePendingApply" },
    },
    states: {
      idle: {
        on: {
          CHECK_STARTED: { target: "checking", actions: "setCheckStart" },
          WAITING_DETECTED: {
            target: "update_detected",
            actions: ["storeWaiting", "announceWaiting", "queueEvaluateReady"],
          },
          AUTO_SUPPRESS: { actions: ["setAutoSuppressed", "announceSuppressed"] },
          AUTO_RESUME: { actions: ["clearAutoSuppressed", "announceResume"] },
          FORCE_HOLD: { actions: ["addForceHold", "announceForceHold"] },
          FORCE_RELEASE: { actions: ["releaseForceHold", "announceForceRelease"] },
        },
      },
      checking: {
        entry: "setCheckStart",
        on: {
          WAITING_DETECTED: {
            target: "update_detected",
            actions: ["storeWaiting", "announceWaiting", "queueEvaluateReady"],
          },
          CHECK_COMPLETED: [
            {
              guard: { type: "hasWaiting" },
              target: "update_detected",
              actions: "queueEvaluateReady",
            },
            { target: "idle" },
          ],
          CHECK_FAILED: { target: "idle", actions: "setCheckFailure" },
          AUTO_SUPPRESS: { actions: ["setAutoSuppressed", "announceSuppressed"] },
          AUTO_RESUME: { actions: ["clearAutoSuppressed", "announceResume"] },
          FORCE_HOLD: { actions: ["addForceHold", "announceForceHold"] },
          FORCE_RELEASE: { actions: ["releaseForceHold", "announceForceRelease"] },
        },
      },
      update_detected: {
        entry: "queueEvaluateReady",
        on: {
          READY_SUPPRESSED: { target: "suppressed" },
          READY_AUTO: { target: "auto_pending" },
          READY_MANUAL: { target: "waiting_user" },
          WAITING_DETECTED: {
            target: "update_detected",
            internal: false,
            actions: ["storeWaiting", "announceWaiting", "queueEvaluateReady"],
          },
          WAITING_CLEARED: {
            target: "idle",
            actions: ["clearAutoApplyTimer", "clearWaiting", "announceCleared"],
          },
          AUTO_SUPPRESS: { target: "suppressed", actions: ["setAutoSuppressed", "announceSuppressed"] },
          AUTO_RESUME: { actions: ["clearAutoSuppressed", "announceResume", "queueEvaluateReady"] },
          FORCE_HOLD: {
            target: "suppressed",
            actions: ["addForceHold", "announceForceHold"],
          },
          FORCE_RELEASE: { actions: ["releaseForceHold", "announceForceRelease", "queueEvaluateReady"] },
          APPLY_REQUEST: [
            {
              guard: { type: "hasWaiting" },
              target: "applying",
              actions: "startManualApplying",
            },
            { target: "failed", actions: "noWaitingFailure" },
          ],
        },
      },
      auto_pending: {
        entry: "scheduleAutoApplyTimer",
        exit: "clearAutoApplyTimer",
        on: {
          AUTO_TIMER_EXPIRED: [
            {
              guard: { type: "hasWaiting" },
              target: "applying",
              actions: "startAutoApplying",
            },
            { target: "failed", actions: "noWaitingFailure" },
          ],
          APPLY_REQUEST: [
            {
              guard: { type: "hasWaiting" },
              target: "applying",
              actions: "startManualApplying",
            },
            { target: "failed", actions: "noWaitingFailure" },
          ],
          AUTO_SUPPRESS: {
            target: "suppressed",
            actions: ["setAutoSuppressed", "announceSuppressed"],
          },
          AUTO_RESUME: { actions: ["clearAutoSuppressed", "announceResume"] },
          FORCE_HOLD: {
            target: "suppressed",
            actions: ["addForceHold", "announceForceHold"],
          },
          FORCE_RELEASE: {
            actions: ["releaseForceHold", "announceForceRelease", "queueEvaluateReady"],
          },
          WAITING_CLEARED: {
            target: "idle",
            actions: ["clearAutoApplyTimer", "clearWaiting", "announceCleared"],
          },
          WAITING_DETECTED: {
            target: "auto_pending",
            internal: false,
            actions: ["storeWaiting", "announceWaiting"],
          },
        },
      },
      waiting_user: {
        entry: "clearAutoApplyTimer",
        on: {
          APPLY_REQUEST: [
            {
              guard: { type: "hasWaiting" },
              target: "applying",
              actions: "startManualApplying",
            },
            { target: "failed", actions: "noWaitingFailure" },
          ],
          AUTO_SUPPRESS: {
            target: "suppressed",
            actions: ["setAutoSuppressed", "announceSuppressed"],
          },
          AUTO_RESUME: {
            actions: ["clearAutoSuppressed", "announceResume", "queueEvaluateReady"],
          },
          FORCE_HOLD: {
            target: "suppressed",
            actions: ["addForceHold", "announceForceHold"],
          },
          FORCE_RELEASE: {
            actions: ["releaseForceHold", "announceForceRelease", "queueEvaluateReady"],
          },
          WAITING_CLEARED: {
            target: "idle",
            actions: ["clearAutoApplyTimer", "clearWaiting", "announceCleared"],
          },
          WAITING_DETECTED: {
            target: "waiting_user",
            internal: false,
            actions: ["storeWaiting", "announceWaiting"],
          },
          READY_AUTO: { target: "auto_pending" },
          READY_SUPPRESSED: { target: "suppressed" },
        },
      },
      suppressed: {
        entry: "clearAutoApplyTimer",
        on: {
          APPLY_REQUEST: [
            {
              guard: { type: "hasWaiting" },
              target: "applying",
              actions: "startManualApplying",
            },
            { target: "failed", actions: "noWaitingFailure" },
          ],
          AUTO_RESUME: {
            actions: ["clearAutoSuppressed", "announceResume", "queueEvaluateReady"],
          },
          AUTO_SUPPRESS: { actions: "setAutoSuppressed" },
          FORCE_HOLD: { actions: ["addForceHold", "announceForceHold"] },
          FORCE_RELEASE: {
            actions: ["releaseForceHold", "announceForceRelease", "queueEvaluateReady"],
          },
          WAITING_CLEARED: {
            target: "idle",
            actions: ["clearAutoApplyTimer", "clearWaiting", "announceCleared"],
          },
          WAITING_DETECTED: {
            target: "suppressed",
            internal: false,
            actions: ["storeWaiting", "announceWaiting"],
          },
          READY_AUTO: { target: "auto_pending" },
          READY_MANUAL: { target: "waiting_user" },
          READY_SUPPRESSED: { target: "suppressed" },
        },
      },
      applying: {
        entry: ["clearAutoApplyTimer", "scheduleApplyTimeout"],
        exit: "clearApplyTimeout",
        on: {
          APPLY_SUCCESS: { target: "applied", actions: "handleApplySuccess" },
          APPLY_FAILURE: { target: "failed", actions: "handleApplyFailure" },
          APPLY_TIMEOUT: { target: "failed", actions: "handleApplyTimeout" },
          WAITING_CLEARED: [
            {
              guard: { type: "clearResultActivated" },
              target: "applied",
              actions: "handleApplySuccess",
            },
            {
              guard: { type: "clearResultRedundant" },
              target: "failed",
              actions: "handleApplyRedundant",
            },
            {
              target: "idle",
              actions: ["clearAutoApplyTimer", "clearWaiting", "announceCleared"],
            },
          ],
        },
      },
      applied: {
        entry: "resetRetry",
        on: {
          WAITING_DETECTED: {
            target: "update_detected",
            actions: ["storeWaiting", "announceWaiting", "queueEvaluateReady"],
          },
          WAITING_CLEARED: {
            target: "idle",
            actions: ["clearWaiting", "announceCleared"],
          },
          AUTO_SUPPRESS: { actions: ["setAutoSuppressed", "announceSuppressed"] },
          AUTO_RESUME: { actions: ["clearAutoSuppressed", "announceResume", "queueEvaluateReady"] },
          FORCE_HOLD: { actions: ["addForceHold", "announceForceHold"] },
          FORCE_RELEASE: { actions: ["releaseForceHold", "announceForceRelease", "queueEvaluateReady"] },
        },
      },
      failed: {
        entry: "incrementRetry",
        on: {
          RETRY: [
            {
              guard: { type: "hasWaiting" },
              target: "applying",
              actions: "startRetryApplying",
            },
            { target: "failed", actions: "noWaitingFailure" },
          ],
          WAITING_DETECTED: {
            target: "update_detected",
            actions: ["storeWaiting", "announceWaiting", "queueEvaluateReady"],
          },
          WAITING_CLEARED: {
            target: "idle",
            actions: ["clearWaiting", "announceCleared"],
          },
          AUTO_SUPPRESS: { actions: ["setAutoSuppressed", "announceSuppressed"] },
          AUTO_RESUME: { actions: ["clearAutoSuppressed", "announceResume", "queueEvaluateReady"] },
          FORCE_HOLD: { actions: ["addForceHold", "announceForceHold"] },
          FORCE_RELEASE: { actions: ["releaseForceHold", "announceForceRelease", "queueEvaluateReady"] },
        },
      },
    },
  });
}
