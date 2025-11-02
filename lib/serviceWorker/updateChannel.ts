import { logSafeUpdateTelemetry } from "@/lib/telemetry/safeUpdate";

type UpdateListener = (registration: ServiceWorkerRegistration | null) => void;
type SnapshotListener = (snapshot: SafeUpdateSnapshot) => void;

export type SafeUpdatePhase =
  | "idle"
  | "checking"
  | "ready"
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
};

export type ApplyServiceWorkerOptions = {
  reason?: string;
  safeMode?: boolean;
};

const updateListeners = new Set<UpdateListener>();
const snapshotListeners = new Set<SnapshotListener>();

let waitingRegistration: ServiceWorkerRegistration | null = null;

const state: SafeUpdateSnapshot = {
  phase: "idle",
  waitingSince: null,
  waitingVersion: null,
  lastCheckAt: null,
  lastError: null,
  autoApplySuppressed: false,
  pendingReload: false,
  applyReason: null,
};

let pendingReload = false;

type InternalApplyContext = ApplyServiceWorkerOptions & {
  startedAt: number;
  attemptId: number;
};

let pendingApplyContext: InternalApplyContext | null = null;
let applyTimeoutId: number | null = null;
let forceApplyTimerId: number | null = null;
let preCheckPhase: SafeUpdatePhase | null = null;
let applyAttemptSequence = 0;
let autoApplySuppressed = false;

const FORCE_APPLY_HOLD_DEFAULT = "__default__";
const forceApplyHolds = new Map<string, number>();

const APPLY_TIMEOUT_MS = 12_000;
const FORCE_APPLY_DELAY_MS = 60_000;
const BROADCAST_CHANNEL_NAME = "ito-safe-update-v1";

const broadcast =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    : null;

if (broadcast) {
  broadcast.addEventListener("message", (event) => {
    handleBroadcastMessage(event.data);
  });
}

function cloneSnapshot(): SafeUpdateSnapshot {
  return { ...state };
}

function notifyListeners() {
  snapshotListeners.forEach((listener) => {
    try {
      listener(cloneSnapshot());
    } catch {
      /* ignore listener failure */
    }
  });
  updateListeners.forEach((listener) => {
    try {
      listener(waitingRegistration);
    } catch {
      /* ignore listener failure */
    }
  });
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

function setWaitingRegistration(
  registration: ServiceWorkerRegistration | null,
  shouldBroadcast: boolean,
  source?: string
) {
  waitingRegistration = registration;
  if (registration) {
    state.waitingSince = state.waitingSince ?? Date.now();
    state.waitingVersion = extractVersionTag(registration);
    if (state.phase !== "applying") {
      state.phase = "ready";
    }
    state.lastError = null;
    scheduleForceApplyTimer();
    if (shouldBroadcast) {
      broadcast?.postMessage({
        type: "update-ready",
        version: state.waitingVersion,
        source,
      });
    }
  } else {
    clearForceApplyTimer();
    state.waitingSince = null;
    state.waitingVersion = null;
    if (state.phase === "checking" && preCheckPhase) {
      state.phase = preCheckPhase;
    } else if (state.phase !== "applying" && state.phase !== "failed") {
      state.phase = "idle";
    }
    if (shouldBroadcast) {
      broadcast?.postMessage({ type: "update-cleared", source });
    }
  }
  notifyListeners();
}

function clearApplyTimeout() {
  if (typeof window === "undefined") {
    return;
  }
  if (applyTimeoutId !== null) {
    window.clearTimeout(applyTimeoutId);
    applyTimeoutId = null;
  }
}

function clearForceApplyTimer() {
  if (typeof window === "undefined") {
    forceApplyTimerId = null;
    return;
  }
  if (forceApplyTimerId !== null) {
    window.clearTimeout(forceApplyTimerId);
    forceApplyTimerId = null;
  }
}

function scheduleApplyTimeout(reason: string, safeMode: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  clearApplyTimeout();
  applyTimeoutId = window.setTimeout(() => {
    if (state.phase === "applying") {
      const contextReason = pendingApplyContext?.reason ?? reason;
      const contextSafeMode = pendingApplyContext?.safeMode ?? safeMode;
      markApplyFailure("timeout", contextReason, contextSafeMode);
    }
  }, APPLY_TIMEOUT_MS);
}

function normalizeForceHoldReason(reason?: string): string {
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  return trimmed.length > 0 ? trimmed : FORCE_APPLY_HOLD_DEFAULT;
}

function hasForceApplyHold(): boolean {
  return forceApplyHolds.size > 0;
}

function registerForceApplyHold(reason: string | undefined, shouldBroadcast: boolean) {
  const key = normalizeForceHoldReason(reason);
  const nextCount = (forceApplyHolds.get(key) ?? 0) + 1;
  forceApplyHolds.set(key, nextCount);
  clearForceApplyTimer();
  if (shouldBroadcast) {
    broadcast?.postMessage({ type: "force-hold", detail: key });
  }
}

function registerForceApplyRelease(reason: string | undefined, shouldBroadcast: boolean) {
  const key = normalizeForceHoldReason(reason);
  const current = forceApplyHolds.get(key);
  if (!current) {
    return;
  }
  if (current <= 1) {
    forceApplyHolds.delete(key);
  } else {
    forceApplyHolds.set(key, current - 1);
  }
  if (shouldBroadcast) {
    broadcast?.postMessage({ type: "force-release", detail: key });
  }
  if (!hasForceApplyHold()) {
    scheduleForceApplyTimer();
  }
}

function scheduleForceApplyTimer() {
  if (typeof window === "undefined") {
    return;
  }
  if (!waitingRegistration?.waiting) {
    clearForceApplyTimer();
    return;
  }
  if (hasForceApplyHold()) {
    clearForceApplyTimer();
    return;
  }
  clearForceApplyTimer();
  forceApplyTimerId = window.setTimeout(() => {
    forceApplyTimerId = null;
    if (!waitingRegistration?.waiting) {
      return;
    }
    if (state.phase === "applying" || pendingReload) {
      return;
    }
    applyServiceWorkerUpdate({ reason: "timeout" });
  }, FORCE_APPLY_DELAY_MS);
}

function handleApplySuccess(options?: { broadcastEvent?: boolean }) {
  const broadcastEvent = options?.broadcastEvent !== false;
  clearApplyTimeout();
  clearForceApplyTimer();
  state.lastError = null;
  state.phase = "applied";
  state.pendingReload = pendingReload;
  state.applyReason = pendingApplyContext?.reason ?? state.applyReason;
  notifyListeners();
  if (broadcastEvent) {
    broadcast?.postMessage({ type: "update-applied" });
  }
}

function markApplyFailure(detail: string, reason: string, safeMode: boolean) {
  clearApplyTimeout();
  clearForceApplyTimer();
  pendingReload = false;
  state.pendingReload = false;
  state.phase = "failed";
  state.lastError = detail;
  state.applyReason = reason;
  logSafeUpdateTelemetry("failure", { reason, safeMode, detail });
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn("[sw] applying service worker failed", { reason, detail });
  }
  broadcast?.postMessage({ type: "update-failed", detail });
  pendingApplyContext = null;
  notifyListeners();
  scheduleForceApplyTimer();
}

function handleBroadcastMessage(message: unknown) {
  if (!message || typeof message !== "object") {
    return;
  }
  const payload = message as { type?: string; detail?: string };
  switch (payload.type) {
    case "update-ready":
      void resyncWaitingServiceWorker("broadcast-ready");
      break;
    case "force-hold":
      registerForceApplyHold(payload.detail, false);
      break;
    case "force-release":
      registerForceApplyRelease(payload.detail, false);
      break;
    case "update-cleared":
      if (!pendingReload) {
        setWaitingRegistration(null, false, "broadcast-cleared");
      }
      break;
    case "update-applied":
      if (waitingRegistration || state.phase === "applying" || state.waitingSince) {
        handleApplySuccess({ broadcastEvent: false });
      }
      break;
    case "update-failed": {
      clearApplyTimeout();
      pendingReload = false;
      state.pendingReload = false;
      state.phase = "failed";
      state.lastError =
        typeof payload.detail === "string" ? payload.detail : "unknown";
      state.applyReason = pendingApplyContext?.reason ?? state.applyReason;
      pendingApplyContext = null;
      notifyListeners();
      break;
    }
    case "suppress":
      autoApplySuppressed = true;
      state.autoApplySuppressed = true;
      notifyListeners();
      break;
    case "resume-auto":
      autoApplySuppressed = false;
      state.autoApplySuppressed = false;
      notifyListeners();
      break;
    default:
      break;
  }
}

export function subscribeToServiceWorkerUpdates(listener: UpdateListener): () => void {
  updateListeners.add(listener);
  try {
    listener(waitingRegistration);
  } catch {
    /* ignore immediate listener failure */
  }
  return () => {
    updateListeners.delete(listener);
  };
}

export function subscribeToSafeUpdateSnapshot(listener: SnapshotListener): () => void {
  snapshotListeners.add(listener);
  try {
    listener(cloneSnapshot());
  } catch {
    /* ignore immediate listener failure */
  }
  return () => {
    snapshotListeners.delete(listener);
  };
}

export function getSafeUpdateSnapshot(): SafeUpdateSnapshot {
  return cloneSnapshot();
}

export function getWaitingServiceWorker(): ServiceWorkerRegistration | null {
  return waitingRegistration;
}

export function announceServiceWorkerUpdate(
  registration: ServiceWorkerRegistration | null
) {
  setWaitingRegistration(registration, true, "announce");
}

export function applyServiceWorkerUpdate(
  options?: ApplyServiceWorkerOptions
): boolean {
  const reason = options?.reason ?? "manual";
  const safeMode = options?.safeMode === true;
  const isAutomatic = reason !== "manual";

  if (autoApplySuppressed && isAutomatic) {
    logSafeUpdateTelemetry("suppressed", { reason, safeMode });
    state.lastError = "suppressed";
    notifyListeners();
    return false;
  }

  const registration = waitingRegistration;
  const waitingWorker = registration?.waiting;
  if (!registration || !waitingWorker) {
    logSafeUpdateTelemetry("no_waiting", { reason, safeMode });
    state.lastError = "no_waiting";
    state.phase = "failed";
    notifyListeners();
    return false;
  }

  try {
    pendingReload = true;
    state.pendingReload = true;
    state.phase = "applying";
    state.lastError = null;
    state.applyReason = reason;
    clearForceApplyTimer();
    applyAttemptSequence += 1;
    pendingApplyContext = {
      reason,
      safeMode,
      startedAt: Date.now(),
      attemptId: applyAttemptSequence,
    };
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    scheduleApplyTimeout(reason, safeMode);
    logSafeUpdateTelemetry("triggered", { reason, safeMode });
    broadcast?.postMessage({ type: "update-applying", reason });
    notifyListeners();
    return true;
  } catch {
    markApplyFailure("exception", reason, safeMode);
    return false;
  }
}

export function consumePendingReloadFlag(): boolean {
  if (!pendingReload) {
    return false;
  }
  pendingReload = false;
  state.pendingReload = false;
  notifyListeners();
  return true;
}

export function consumePendingApplyContext(): ApplyServiceWorkerOptions | null {
  if (!pendingApplyContext) {
    return null;
  }
  const { reason, safeMode } = pendingApplyContext;
  pendingApplyContext = null;
  state.applyReason = null;
  notifyListeners();
  return { reason, safeMode };
}

export function holdForceApplyTimer(reason?: string) {
  registerForceApplyHold(reason, true);
}

export function releaseForceApplyTimer(reason?: string) {
  registerForceApplyRelease(reason, true);
}

export function suppressAutoApply() {
  autoApplySuppressed = true;
  state.autoApplySuppressed = true;
  broadcast?.postMessage({ type: "suppress" });
  notifyListeners();
}

export function clearAutoApplySuppression() {
  autoApplySuppressed = false;
  state.autoApplySuppressed = false;
  broadcast?.postMessage({ type: "resume-auto" });
  notifyListeners();
}

export function isAutoApplySuppressed(): boolean {
  return autoApplySuppressed;
}

type ClearResult = "activated" | "redundant" | "manual";

export function clearWaitingServiceWorker(options?: { result?: ClearResult }) {
  const result: ClearResult = options?.result ?? "manual";
  if (result === "redundant" && pendingApplyContext) {
    const { reason = "manual", safeMode = false } = pendingApplyContext;
    markApplyFailure("redundant", reason, safeMode);
    setWaitingRegistration(null, true, "clear");
    return;
  }

  setWaitingRegistration(null, true, "clear");

  if (state.phase === "applying") {
    handleApplySuccess();
  } else if (result === "manual") {
    state.lastError = null;
    notifyListeners();
  }
}

export function markUpdateCheckStart() {
  if (state.phase === "applying") {
    return;
  }
  preCheckPhase = state.phase;
  state.phase = "checking";
  state.lastCheckAt = Date.now();
  notifyListeners();
}

export function markUpdateCheckEnd() {
  if (state.phase !== "checking") {
    return;
  }
  state.phase = waitingRegistration ? "ready" : preCheckPhase ?? "idle";
  preCheckPhase = null;
  notifyListeners();
}

export function markUpdateCheckError(detail: string) {
  if (state.phase !== "checking") {
    return;
  }
  state.phase = preCheckPhase ?? "idle";
  preCheckPhase = null;
  state.lastError = detail;
  notifyListeners();
}

export async function resyncWaitingServiceWorker(source?: string): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) {
      setWaitingRegistration(registration, false, source ?? "resync");
    } else if (!pendingReload) {
      setWaitingRegistration(null, false, source ?? "resync");
    }
  } catch {
    // ignore resync failures
  }
}
