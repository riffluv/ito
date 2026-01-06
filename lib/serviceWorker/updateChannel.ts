import { logSafeUpdateTelemetry } from "@/lib/telemetry/safeUpdate";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  buildTelemetryOptions,
  createInitialContext,
  createSafeUpdateMachine,
  getRequiredSwVersionHint,
  hasForceHold,
  normalizeHoldReason,
  setRequiredSwVersionHint,
  type ApplyServiceWorkerOptions,
  type ClearResult,
  type SafeUpdateContext,
  type SafeUpdateEvent,
  type SafeUpdatePhase,
  type SafeUpdateSnapshot,
} from "./safeUpdateMachine";
import {
  addSnapshotListener,
  addUpdateListener,
  getCurrentSnapshot,
  getCurrentWaitingRegistration,
  notifyUpdateChannelListeners,
  removeSnapshotListener,
  removeUpdateListener,
  setCurrentSnapshot,
  setCurrentWaitingRegistration,
  type SnapshotListener,
  type UpdateListener,
} from "./updateChannelState";
import { createActor, type ActorRefFrom, type StateFrom } from "xstate";

export type { ApplyServiceWorkerOptions, SafeUpdatePhase, SafeUpdateSnapshot };
export { getRequiredSwVersionHint, setRequiredSwVersionHint };

type SafeUpdateSnapshotState = StateFrom<typeof safeUpdateMachine>;

// Some environments appear to keep the waiting SW stuck in `installed` when heavy worker clients are alive.
// Fall back to a hard reload (which closes those clients) if SKIP_WAITING doesn't progress quickly.
const APPLY_FALLBACK_RELOAD_MS = 5_000;
const APPLY_FALLBACK_RELOAD_SESSION_KEY = "ito-safe-update-fallback-reload-count";
const APPLY_FALLBACK_RELOAD_LIMIT = 2;
const BROADCAST_CHANNEL_NAME = "ito-safe-update-v1";
const IN_GAME_HOLD_KEY = "in-game";

let previousPhase: SafeUpdatePhase = "idle";

const isBrowser =
  typeof window !== "undefined" && typeof navigator !== "undefined" && "serviceWorker" in navigator;

const broadcast =
  isBrowser && "BroadcastChannel" in window
    ? new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    : null;

function now(): number {
  return Date.now();
}

const safeUpdateMachine = createSafeUpdateMachine({
  isBrowser,
  broadcast,
  startApply,
  now,
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

function handleStateChange(state: SafeUpdateSnapshotState) {
  setCurrentWaitingRegistration(state.context.waitingRegistration ?? null);
  const nextSnapshot = createSnapshot(state);
  const nextPhase = nextSnapshot.phase;
  const eventType = ((state as unknown as { event?: SafeUpdateEvent }).event?.type) ?? "INIT";
  const previousSnapshot = getCurrentSnapshot();
  const changed =
    nextPhase !== previousSnapshot.phase ||
    nextSnapshot.lastError !== previousSnapshot.lastError ||
    nextSnapshot.pendingReload !== previousSnapshot.pendingReload ||
    nextSnapshot.autoApplySuppressed !== previousSnapshot.autoApplySuppressed ||
    nextSnapshot.autoApplyAt !== previousSnapshot.autoApplyAt ||
    nextSnapshot.waitingSince !== previousSnapshot.waitingSince ||
    nextSnapshot.retryCount !== previousSnapshot.retryCount ||
    nextSnapshot.waitingVersion !== previousSnapshot.waitingVersion;

  setCurrentSnapshot(nextSnapshot);

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
    notifyUpdateChannelListeners(nextSnapshot);
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
  void resyncWaitingServiceWorker("actor-init");
  return safeUpdateActor;
}

function getCurrentContext(): SafeUpdateContext {
  const actor = ensureActor();
  return actor?.getSnapshot().context ?? createInitialContext();
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
    case "update-applying":
      traceAction("safeUpdate.sw.applying", { source: "broadcast" });
      break;
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

  const controllerBefore =
    typeof navigator !== "undefined"
      ? navigator.serviceWorker?.controller?.scriptURL ?? null
      : null;
  const waitingUrl = waiting.scriptURL;

  // Service Worker 更新の適用直前に、重い Worker（OffscreenCanvas など）を止めておく。
  // これが生きているとブラウザが skipWaiting/activate を進められず apply がタイムアウトするケースがある。
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new Event("ito-safe-update-apply"));
    } catch {
      /* noop */
    }
  }
  try {
    waiting.postMessage({ type: "SKIP_WAITING" });
  } catch (error) {
    traceError("safeUpdate.apply.postMessage", error, {
      reason: params.reason,
      safeMode: params.safeMode,
    });
  }

  if (typeof window !== "undefined" && typeof navigator !== "undefined") {
    window.setTimeout(() => {
      try {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          return;
        }
        if (getCurrentSnapshot().phase !== "applying") {
          return;
        }
        const controllerUrl = navigator.serviceWorker?.controller?.scriptURL ?? null;
        if (controllerBefore && controllerUrl && controllerUrl !== controllerBefore) {
          return;
        }
        const count = Number(sessionStorage.getItem(APPLY_FALLBACK_RELOAD_SESSION_KEY) ?? "0");
        if (!Number.isFinite(count) || count >= APPLY_FALLBACK_RELOAD_LIMIT) {
          return;
        }
        void navigator.serviceWorker
          .getRegistration()
          .then((reg) => {
            const waitingNow = reg?.waiting?.scriptURL ?? null;
            if (!waitingNow || waitingNow !== waitingUrl) {
              return;
            }
            traceAction("safeUpdate.apply.fallbackReload", {
              reason: params.reason,
              safeMode: params.safeMode,
              waitingUrl,
              controllerBefore,
              count: count + 1,
              delayMs: APPLY_FALLBACK_RELOAD_MS,
            });
            sessionStorage.setItem(
              APPLY_FALLBACK_RELOAD_SESSION_KEY,
              String(count + 1)
            );
            window.location.reload();
          })
          .catch(() => undefined);
      } catch (error) {
        traceError("safeUpdate.apply.fallbackReloadFailed", error, {
          reason: params.reason,
          safeMode: params.safeMode,
          waitingUrl,
        });
      }
    }, APPLY_FALLBACK_RELOAD_MS);
  }
  logSafeUpdateTelemetry(
    "triggered",
    buildTelemetryOptions(context, { reason: params.reason, safeMode: params.safeMode })
  );
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
  addUpdateListener(listener);
  try {
    listener(getCurrentWaitingRegistration());
  } catch {
    /* ignore */
  }
  return () => {
    removeUpdateListener(listener);
  };
}

export function subscribeToSafeUpdateSnapshot(listener: SnapshotListener): () => void {
  const actor = ensureActor();
  if (!actor) {
    listener({ ...getCurrentSnapshot() });
    return () => {
      /* noop */
    };
  }
  addSnapshotListener(listener);
  try {
    listener({ ...getCurrentSnapshot() });
  } catch {
    /* ignore */
  }
  return () => {
    removeSnapshotListener(listener);
  };
}

export function getSafeUpdateSnapshot(): SafeUpdateSnapshot {
  ensureActor();
  return { ...getCurrentSnapshot() };
}

export function getWaitingServiceWorker(): ServiceWorkerRegistration | null {
  ensureActor();
  return getCurrentWaitingRegistration();
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
  const phase = resolvePhase(snapshot);
  if (automatic && context) {
    const held = context.autoApplySuppressed || hasForceHold(context.autoApplyHolds);
    if (held || phase === "suppressed") {
      logSafeUpdateTelemetry(
        "suppressed",
        buildTelemetryOptions(context ?? createInitialContext(), { reason, safeMode })
      );
      traceAction("safeUpdate.apply.suppressed", {
        reason,
        safeMode,
        held,
        phase,
      });
      return false;
    }
  }
  // `failed` からの再試行は `RETRY` が正規ルート（APPLY_REQUEST だと machine が動かない）。
  actor.send(
    phase === "failed"
      ? { type: "RETRY", reason, safeMode, automatic }
      : { type: "APPLY_REQUEST", reason, safeMode, automatic }
  );
  const nextPhase = resolvePhase(actor.getSnapshot());
  return nextPhase === "applying";
}

export function consumePendingReloadFlag(): boolean {
  const actor = ensureActor();
  if (!actor) return false;
  if (!getCurrentSnapshot().pendingReload) {
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

// Convenience helpers for game-phase aware hold.
export function holdInGameAutoApply() {
  holdForceApplyTimer(IN_GAME_HOLD_KEY);
}

export function releaseInGameAutoApply() {
  releaseForceApplyTimer(IN_GAME_HOLD_KEY);
}

type SafeUpdateFetchErrorPayload = {
  url: string;
  status?: number | null;
  version?: string | null;
  method?: string | null;
  scope?: string | null;
  error?: string | null;
};

export function handleServiceWorkerFetchError(detail: SafeUpdateFetchErrorPayload) {
  const context = getCurrentContext();
  const detailTag =
    typeof detail.status === "number"
      ? `fetch_${detail.status}`
      : detail.error ?? "fetch_error";
  logSafeUpdateTelemetry(
    "failure",
    buildTelemetryOptions(context, {
      reason: "sw.fetch",
      detail: detailTag,
    })
  );
  traceError("safeUpdate.fetchError", detail.error ?? "sw fetch error", {
    url: detail.url,
    status: detail.status ?? null,
    swVersion: detail.version ?? null,
    method: detail.method ?? null,
    scope: detail.scope ?? null,
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
  return getCurrentSnapshot().autoApplySuppressed;
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
