import { logSafeUpdateTelemetry } from "@/lib/telemetry/safeUpdate";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  assign,
  createActor,
  setup,
  type ActorRefFrom,
  type StateFrom,
} from "xstate";

type UpdateListener = (registration: ServiceWorkerRegistration | null) => void;
type SnapshotListener = (snapshot: SafeUpdateSnapshot) => void;

export type SafeUpdatePhase =
  | "idle"
  | "checking"
  | "update_detected"
  | "auto_pending"
  | "waiting_user"
  | "suppressed"
  | "applying"
  | "applied"
  | "failed";

export type SafeUpdateSnapshot = {
  phase: SafeUpdatePhase;
  waitingSince: number | null;
  waitingVersion: string | null;
  lastCheckAt: number | null;
  lastError: string | null;
  autoApplySuppressed: boolean;
  pendingReload: boolean;
  applyReason: string | null;
  autoApplyAt: number | null;
  retryCount: number;
};

export type ApplyServiceWorkerOptions = {
  reason?: string;
  safeMode?: boolean;
};

type ForceHoldMap = Record<string, number>;
type ClearResult = "activated" | "redundant" | "manual";

type InternalApplyContext = {
  reason: string;
  safeMode: boolean;
  startedAt: number;
  attemptId: number;
  automatic: boolean;
};

type SafeUpdateContext = {
  waitingRegistration: ServiceWorkerRegistration | null;
  waitingVersion: string | null;
  waitingSince: number | null;
  lastCheckAt: number | null;
  lastError: string | null;
  autoApplySuppressed: boolean;
  autoApplyHolds: ForceHoldMap;
  autoApplyAt: number | null;
  pendingReload: boolean;
  applyReason: string | null;
  pendingApply: InternalApplyContext | null;
  retryCount: number;
  attemptSeq: number;
  applyTimeoutId: number | null;
  autoApplyTimerId: number | null;
};

type WaitingDetectedEvent = {
  type: "WAITING_DETECTED";
  registration: ServiceWorkerRegistration;
  source?: string;
  broadcast?: boolean;
};

type WaitingClearedEvent = {
  type: "WAITING_CLEARED";
  result: ClearResult;
  source?: string;
  broadcast?: boolean;
};

type ApplyRequestEvent = {
  type: "APPLY_REQUEST";
  reason: string;
  safeMode: boolean;
  automatic: boolean;
};

type ApplyFailureEvent = {
  type: "APPLY_FAILURE";
  detail: string;
  reason: string;
  safeMode: boolean;
  broadcast?: boolean;
};

type ApplySuccessEvent = {
  type: "APPLY_SUCCESS";
  broadcast?: boolean;
};

type AutoControlEvent =
  | { type: "AUTO_SUPPRESS"; reason?: string; broadcast?: boolean }
  | { type: "AUTO_RESUME"; reason?: string; broadcast?: boolean };

type HoldEvent =
  | { type: "FORCE_HOLD"; key: string; broadcast?: boolean }
  | { type: "FORCE_RELEASE"; key: string; broadcast?: boolean };

type RetryEvent = { type: "RETRY"; reason: string; safeMode: boolean; automatic: boolean };

type SafeUpdateEvent =
  | { type: "CHECK_STARTED"; timestamp: number }
  | { type: "CHECK_COMPLETED" }
  | { type: "CHECK_FAILED"; detail: string }
  | WaitingDetectedEvent
  | WaitingClearedEvent
  | { type: "READY_AUTO" }
  | { type: "READY_MANUAL" }
  | { type: "READY_SUPPRESSED" }
  | AutoControlEvent
  | HoldEvent
  | { type: "AUTO_TIMER_EXPIRED" }
  | ApplyRequestEvent
  | ApplySuccessEvent
  | ApplyFailureEvent
  | { type: "APPLY_TIMEOUT" }
  | RetryEvent
  | { type: "RELOAD_CONSUMED" }
  | { type: "PENDING_APPLY_CONSUMED" };

type SafeUpdateSnapshotState = StateFrom<typeof safeUpdateMachine>;

const APPLY_TIMEOUT_MS = 12_000;
const AUTO_APPLY_DELAY_MS = 60_000;
const BROADCAST_CHANNEL_NAME = "ito-safe-update-v1";
const FORCE_APPLY_HOLD_DEFAULT = "__default__";
const AUTO_APPLY_REASON = "auto-timer";

const updateListeners = new Set<UpdateListener>();
const snapshotListeners = new Set<SnapshotListener>();

let currentWaitingRegistration: ServiceWorkerRegistration | null = null;
let currentSnapshot: SafeUpdateSnapshot = {
  phase: "idle",
  waitingSince: null,
  waitingVersion: null,
  lastCheckAt: null,
  lastError: null,
  autoApplySuppressed: false,
  pendingReload: false,
  applyReason: null,
  autoApplyAt: null,
  retryCount: 0,
};
let previousPhase: SafeUpdatePhase = "idle";

const isBrowser =
  typeof window !== "undefined" && typeof navigator !== "undefined" && "serviceWorker" in navigator;

const broadcast =
  isBrowser && "BroadcastChannel" in window
    ? new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    : null;

function normalizeHoldReason(reason?: string): string {
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  return trimmed.length > 0 ? trimmed : FORCE_APPLY_HOLD_DEFAULT;
}

function hasForceHold(holds: ForceHoldMap): boolean {
  return Object.values(holds).some((count) => count > 0);
}

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

function now(): number {
  return Date.now();
}

function createInitialContext(): SafeUpdateContext {
  return {
    waitingRegistration: null,
    waitingVersion: null,
    waitingSince: null,
    lastCheckAt: null,
    lastError: null,
    autoApplySuppressed: false,
    autoApplyHolds: {},
    autoApplyAt: null,
    pendingReload: false,
    applyReason: null,
    pendingApply: null,
    retryCount: 0,
    attemptSeq: 0,
    applyTimeoutId: null,
    autoApplyTimerId: null,
  };
}
const safeUpdateMachine = setup({
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
    setCheckStart: assign(({ context, event }) => {
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
      logSafeUpdateTelemetry("applied", { reason, safeMode });
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
      logSafeUpdateTelemetry("failure", { reason, safeMode, detail });
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
      logSafeUpdateTelemetry("failure", { reason, safeMode, detail: "timeout" });
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
      logSafeUpdateTelemetry("failure", { reason, safeMode, detail: "redundant" });
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
    noWaitingFailure: assign(({ event }) => {
      const reason =
        event.type === "APPLY_REQUEST" || event.type === "RETRY"
          ? event.reason
          : event.type === "AUTO_TIMER_EXPIRED"
          ? AUTO_APPLY_REASON
          : "manual";
      logSafeUpdateTelemetry("no_waiting", { reason });
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
          { target: "idle", actions: ["clearAutoApplyTimer", "clearWaiting", "announceCleared"] },
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
function resolvePhase(state: SafeUpdateSnapshotState): SafeUpdatePhase {
  const value = state.value;
  return typeof value === "string" ? (value as SafeUpdatePhase) : "idle";
}

function createSnapshot(state: SafeUpdateSnapshotState): SafeUpdateSnapshot {
  const phase = resolvePhase(state);
  const {
    waitingSince,
    waitingVersion,
    lastCheckAt,
    lastError,
    autoApplySuppressed,
    pendingReload,
    applyReason,
    autoApplyAt,
    retryCount,
  } = state.context;
  return {
    phase,
    waitingSince,
    waitingVersion,
    lastCheckAt,
    lastError,
    autoApplySuppressed,
    pendingReload,
    applyReason,
    autoApplyAt,
    retryCount,
  };
}

function notifyListeners(snapshot: SafeUpdateSnapshot) {
  snapshotListeners.forEach((listener) => {
    try {
      listener({ ...snapshot });
    } catch {
      /* ignore */
    }
  });
  updateListeners.forEach((listener) => {
    try {
      listener(currentWaitingRegistration);
    } catch {
      /* ignore */
    }
  });
}

function handleStateChange(state: SafeUpdateSnapshotState) {
  currentWaitingRegistration = state.context.waitingRegistration ?? null;
  const nextSnapshot = createSnapshot(state);
  const nextPhase = nextSnapshot.phase;
  const eventType = ((state as unknown as { event?: SafeUpdateEvent }).event?.type) ?? "INIT";
  const changed =
    nextPhase !== currentSnapshot.phase ||
    nextSnapshot.lastError !== currentSnapshot.lastError ||
    nextSnapshot.pendingReload !== currentSnapshot.pendingReload ||
    nextSnapshot.autoApplySuppressed !== currentSnapshot.autoApplySuppressed ||
    nextSnapshot.autoApplyAt !== currentSnapshot.autoApplyAt ||
    nextSnapshot.waitingSince !== currentSnapshot.waitingSince ||
    nextSnapshot.retryCount !== currentSnapshot.retryCount ||
    nextSnapshot.waitingVersion !== currentSnapshot.waitingVersion;

  const previousSnapshot = currentSnapshot;
  currentSnapshot = nextSnapshot;

  const transitionChanged =
    ((state as unknown as { changed?: boolean }).changed ?? false) ||
    nextPhase !== previousSnapshot.phase;

  if (transitionChanged && previousPhase !== nextPhase) {
    traceAction("safeUpdate.transition", {
      from: previousPhase,
      to: nextPhase,
      event: eventType,
      version: nextSnapshot.waitingVersion ?? null,
    });
    previousPhase = nextPhase;
  }

  if (changed) {
    notifyListeners(nextSnapshot);
  }
}

let safeUpdateActor: ActorRefFrom<typeof safeUpdateMachine> | null = null;

function ensureActor(): ActorRefFrom<typeof safeUpdateMachine> | null {
  if (safeUpdateActor || !isBrowser) {
    return safeUpdateActor;
  }
  safeUpdateActor = createActor(safeUpdateMachine);
  safeUpdateActor.subscribe(handleStateChange);
  safeUpdateActor.start();
  return safeUpdateActor;
}

if (broadcast) {
  broadcast.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") {
      return;
    }
    void handleBroadcastMessage(data as { type?: string; detail?: string });
  });
}

async function handleBroadcastMessage(message: { type?: string; detail?: string }) {
  const actor = ensureActor();
  if (!actor) return;
  switch (message.type) {
    case "update-ready":
      await resyncWaitingServiceWorker("broadcast-ready");
      break;
    case "update-cleared":
      actor.send({ type: "WAITING_CLEARED", result: "manual", source: "broadcast", broadcast: false });
      break;
    case "update-applied":
      actor.send({ type: "APPLY_SUCCESS", broadcast: false });
      actor.send({ type: "WAITING_CLEARED", result: "activated", source: "broadcast", broadcast: false });
      break;
    case "update-failed":
      actor.send({
        type: "APPLY_FAILURE",
        detail: typeof message.detail === "string" ? message.detail : "unknown",
        reason: "remote",
        safeMode: false,
        broadcast: false,
      });
      break;
    case "suppress":
      actor.send({ type: "AUTO_SUPPRESS", reason: "broadcast", broadcast: false });
      break;
    case "resume-auto":
      actor.send({ type: "AUTO_RESUME", reason: "broadcast", broadcast: false });
      break;
    case "force-hold":
      actor.send({
        type: "FORCE_HOLD",
        key: normalizeHoldReason(message.detail),
        broadcast: false,
      });
      break;
    case "force-release":
      actor.send({
        type: "FORCE_RELEASE",
        key: normalizeHoldReason(message.detail),
        broadcast: false,
      });
      break;
    default:
      break;
  }
}
function startApply(
  context: SafeUpdateContext,
  params: { reason: string; safeMode: boolean; automatic: boolean; broadcast: boolean }
): Partial<SafeUpdateContext> {
  const registration = context.waitingRegistration;
  const waiting = registration?.waiting ?? null;
  if (!registration || !waiting) {
    return {
      lastError: "no_waiting",
      pendingReload: false,
      applyReason: params.reason,
    };
  }
  try {
    waiting.postMessage({ type: "SKIP_WAITING" });
  } catch (error) {
    traceError("safeUpdate.apply.postMessage", error, {
      reason: params.reason,
      safeMode: params.safeMode,
    });
  }
  logSafeUpdateTelemetry("triggered", { reason: params.reason, safeMode: params.safeMode });
  traceAction("safeUpdate.apply.start", {
    reason: params.reason,
    safeMode: params.safeMode,
    automatic: params.automatic,
  });
  if (params.broadcast) {
    broadcast?.postMessage({ type: "update-applying", reason: params.reason });
  }
  return {
    pendingReload: true,
    applyReason: params.reason,
    pendingApply: {
      reason: params.reason,
      safeMode: params.safeMode,
      startedAt: now(),
      attemptId: context.attemptSeq + 1,
      automatic: params.automatic,
    },
    attemptSeq: context.attemptSeq + 1,
    lastError: null,
  };
}

export function subscribeToServiceWorkerUpdates(listener: UpdateListener): () => void {
  const actor = ensureActor();
  if (!actor) {
    listener(null);
    return () => {
      /* noop */
    };
  }
  updateListeners.add(listener);
  try {
    listener(currentWaitingRegistration);
  } catch {
    /* ignore */
  }
  return () => {
    updateListeners.delete(listener);
  };
}

export function subscribeToSafeUpdateSnapshot(listener: SnapshotListener): () => void {
  const actor = ensureActor();
  if (!actor) {
    listener({ ...currentSnapshot });
    return () => {
      /* noop */
    };
  }
  snapshotListeners.add(listener);
  try {
    listener({ ...currentSnapshot });
  } catch {
    /* ignore */
  }
  return () => {
    snapshotListeners.delete(listener);
  };
}

export function getSafeUpdateSnapshot(): SafeUpdateSnapshot {
  ensureActor();
  return { ...currentSnapshot };
}

export function getWaitingServiceWorker(): ServiceWorkerRegistration | null {
  ensureActor();
  return currentWaitingRegistration;
}

export function announceServiceWorkerUpdate(
  registration: ServiceWorkerRegistration | null
): void {
  const actor = ensureActor();
  if (!actor) return;
  if (registration) {
    actor.send({
      type: "WAITING_DETECTED",
      registration,
      source: "announce",
      broadcast: true,
    });
  } else {
    actor.send({
      type: "WAITING_CLEARED",
      result: "manual",
      source: "announce",
      broadcast: true,
    });
  }
}

export function applyServiceWorkerUpdate(options?: ApplyServiceWorkerOptions): boolean {
  const actor = ensureActor();
  if (!actor) return false;
  const reason = options?.reason ?? "manual";
  const safeMode = options?.safeMode === true;
  const automatic = reason !== "manual";
  const snapshot = actor.getSnapshot();
  const context = snapshot?.context;
  if (automatic && context?.autoApplySuppressed) {
    logSafeUpdateTelemetry("suppressed", { reason, safeMode });
    traceAction("safeUpdate.apply.suppressed", { reason, safeMode });
    return false;
  }
  actor.send({ type: "APPLY_REQUEST", reason, safeMode, automatic });
  const nextPhase = resolvePhase(actor.getSnapshot());
  return nextPhase === "applying";
}

export function consumePendingReloadFlag(): boolean {
  const actor = ensureActor();
  if (!actor) return false;
  if (!currentSnapshot.pendingReload) {
    return false;
  }
  actor.send({ type: "RELOAD_CONSUMED" });
  return true;
}

export function consumePendingApplyContext(): ApplyServiceWorkerOptions | null {
  const actor = ensureActor();
  if (!actor) return null;
  const pending = actor.getSnapshot().context.pendingApply;
  if (!pending) {
    return null;
  }
  actor.send({ type: "PENDING_APPLY_CONSUMED" });
  return { reason: pending.reason, safeMode: pending.safeMode };
}

export function holdForceApplyTimer(reason?: string) {
  const actor = ensureActor();
  if (!actor) return;
  actor.send({
    type: "FORCE_HOLD",
    key: normalizeHoldReason(reason),
    broadcast: true,
  });
}

export function releaseForceApplyTimer(reason?: string) {
  const actor = ensureActor();
  if (!actor) return;
  actor.send({
    type: "FORCE_RELEASE",
    key: normalizeHoldReason(reason),
    broadcast: true,
  });
}

export function suppressAutoApply() {
  const actor = ensureActor();
  if (!actor) return;
  actor.send({ type: "AUTO_SUPPRESS", reason: "manual", broadcast: true });
}

export function clearAutoApplySuppression() {
  const actor = ensureActor();
  if (!actor) return;
  actor.send({ type: "AUTO_RESUME", reason: "manual", broadcast: true });
}

export function isAutoApplySuppressed(): boolean {
  ensureActor();
  return currentSnapshot.autoApplySuppressed;
}

export function clearWaitingServiceWorker(options?: { result?: ClearResult }) {
  const actor = ensureActor();
  if (!actor) return;
  const result: ClearResult = options?.result ?? "manual";
  if (result === "redundant") {
    const pending = actor.getSnapshot().context.pendingApply;
    actor.send({
      type: "APPLY_FAILURE",
      detail: "redundant",
      reason: pending?.reason ?? "manual",
      safeMode: pending?.safeMode ?? false,
      broadcast: true,
    });
  } else if (result === "activated") {
    actor.send({ type: "APPLY_SUCCESS", broadcast: true });
  }
  actor.send({
    type: "WAITING_CLEARED",
    result,
    source: "clear",
    broadcast: true,
  });
}

export function markUpdateCheckStart() {
  const actor = ensureActor();
  if (!actor) return;
  const phase = resolvePhase(actor.getSnapshot());
  if (phase === "applying") return;
  actor.send({ type: "CHECK_STARTED", timestamp: now() });
}

export function markUpdateCheckEnd() {
  const actor = ensureActor();
  if (!actor) return;
  const phase = resolvePhase(actor.getSnapshot());
  if (phase === "applying") return;
  actor.send({ type: "CHECK_COMPLETED" });
}

export function markUpdateCheckError(detail: string) {
  const actor = ensureActor();
  if (!actor) return;
  const phase = resolvePhase(actor.getSnapshot());
  if (phase === "applying") return;
  actor.send({ type: "CHECK_FAILED", detail });
}

export async function resyncWaitingServiceWorker(source?: string): Promise<void> {
  if (!isBrowser) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const actor = ensureActor();
    if (!actor) return;
    if (registration?.waiting) {
      actor.send({
        type: "WAITING_DETECTED",
        registration,
        source: source ?? "resync",
        broadcast: false,
      });
    } else {
      actor.send({
        type: "WAITING_CLEARED",
        result: "manual",
        source: source ?? "resync",
        broadcast: false,
      });
    }
  } catch (error) {
    traceError("safeUpdate.resync.failed", error, { source });
  }
}

export const __safeUpdateMachine = safeUpdateMachine;
