import { APP_VERSION } from "@/lib/constants/appVersion";
import type { SafeUpdateTelemetryOptions } from "@/lib/telemetry/safeUpdate";

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
export type ClearResult = "activated" | "redundant" | "manual";

type InternalApplyContext = {
  reason: string;
  safeMode: boolean;
  startedAt: number;
  attemptId: number;
  automatic: boolean;
};

export type SafeUpdateContext = {
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

const DEFAULT_TELEMETRY_APP_VERSION = APP_VERSION ?? "unknown";
let requiredSwVersionHint: string | null = null;

export function setRequiredSwVersionHint(version: string | null | undefined) {
  if (typeof version === "string" && version.trim().length > 0) {
    requiredSwVersionHint = version.trim();
  } else {
    requiredSwVersionHint = null;
  }
}

export function getRequiredSwVersionHint(): string | null {
  return requiredSwVersionHint;
}

export function buildTelemetryOptions(
  context: SafeUpdateContext,
  extra?: SafeUpdateTelemetryOptions
): SafeUpdateTelemetryOptions {
  return {
    ...extra,
    waitingVersion: context.waitingVersion ?? undefined,
    appVersion: DEFAULT_TELEMETRY_APP_VERSION,
    requiredSwVersion: requiredSwVersionHint ?? undefined,
  };
}

const FORCE_APPLY_HOLD_DEFAULT = "__default__";

export function normalizeHoldReason(reason?: string): string {
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  return trimmed.length > 0 ? trimmed : FORCE_APPLY_HOLD_DEFAULT;
}

export function hasForceHold(holds: ForceHoldMap): boolean {
  return Object.values(holds).some((count) => count > 0);
}

export function createInitialContext(): SafeUpdateContext {
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

export type SafeUpdateEvent =
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

type BroadcastLike = { postMessage: (message: unknown) => void };

export type StartApplyFn = (
  context: SafeUpdateContext,
  params: { reason: string; safeMode: boolean; automatic: boolean; broadcast: boolean }
) => Partial<SafeUpdateContext>;

export type SafeUpdateMachineDeps = {
  isBrowser: boolean;
  broadcast: BroadcastLike | null;
  startApply: StartApplyFn;
  now?: () => number;
};

