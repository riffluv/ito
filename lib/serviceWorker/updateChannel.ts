import { logSafeUpdateTelemetry } from "@/lib/telemetry/safeUpdate";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  buildTelemetryOptions,
  createInitialContext,
  getRequiredSwVersionHint,
  hasForceHold,
  normalizeHoldReason,
  setRequiredSwVersionHint,
  type ApplyServiceWorkerOptions,
  type ClearResult,
  type SafeUpdatePhase,
  type SafeUpdateSnapshot,
} from "./safeUpdateMachine";
import {
  addSnapshotListener,
  addUpdateListener,
  getCurrentSnapshot,
  getCurrentWaitingRegistration,
  removeSnapshotListener,
  removeUpdateListener,
  type SnapshotListener,
  type UpdateListener,
} from "./updateChannelState";
import { resolvePhase } from "./updateChannelSnapshot";
import { ensureSafeUpdateActor, getSafeUpdateContext, now } from "./updateChannelRuntime";

export type { ApplyServiceWorkerOptions, SafeUpdatePhase, SafeUpdateSnapshot };
export { getRequiredSwVersionHint, setRequiredSwVersionHint };
export { __safeUpdateMachine, resyncWaitingServiceWorker } from "./updateChannelRuntime";

const IN_GAME_HOLD_KEY = "in-game";

export function subscribeToServiceWorkerUpdates(listener: UpdateListener): () => void {
  const actor = ensureSafeUpdateActor();
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
  const actor = ensureSafeUpdateActor();
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
  ensureSafeUpdateActor();
  return { ...getCurrentSnapshot() };
}

export function getWaitingServiceWorker(): ServiceWorkerRegistration | null {
  ensureSafeUpdateActor();
  return getCurrentWaitingRegistration();
}

export function announceServiceWorkerUpdate(
  registration: ServiceWorkerRegistration | null
): void {
  const actor = ensureSafeUpdateActor();
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
  const actor = ensureSafeUpdateActor();
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
  const actor = ensureSafeUpdateActor();
  if (!actor) return false;
  if (!getCurrentSnapshot().pendingReload) {
    return false;
  }
  actor.send({ type: "RELOAD_CONSUMED" });
  return true;
}

export function consumePendingApplyContext(): ApplyServiceWorkerOptions | null {
  const actor = ensureSafeUpdateActor();
  if (!actor) return null;
  const pending = actor.getSnapshot().context.pendingApply;
  if (!pending) {
    return null;
  }
  actor.send({ type: "PENDING_APPLY_CONSUMED" });
  return { reason: pending.reason, safeMode: pending.safeMode };
}

export function holdForceApplyTimer(reason?: string) {
  const actor = ensureSafeUpdateActor();
  if (!actor) return;
  actor.send({
    type: "FORCE_HOLD",
    key: normalizeHoldReason(reason),
    broadcast: true,
  });
}

export function releaseForceApplyTimer(reason?: string) {
  const actor = ensureSafeUpdateActor();
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
  const context = getSafeUpdateContext();
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
  const actor = ensureSafeUpdateActor();
  if (!actor) return;
  actor.send({ type: "AUTO_SUPPRESS", reason: "manual", broadcast: true });
}

export function clearAutoApplySuppression() {
  const actor = ensureSafeUpdateActor();
  if (!actor) return;
  actor.send({ type: "AUTO_RESUME", reason: "manual", broadcast: true });
}

export function isAutoApplySuppressed(): boolean {
  ensureSafeUpdateActor();
  return getCurrentSnapshot().autoApplySuppressed;
}

export function clearWaitingServiceWorker(options?: { result?: ClearResult }) {
  const actor = ensureSafeUpdateActor();
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
  const actor = ensureSafeUpdateActor();
  if (!actor) return;
  const phase = resolvePhase(actor.getSnapshot());
  if (phase === "applying") return;
  actor.send({ type: "CHECK_STARTED", timestamp: now() });
}

export function markUpdateCheckEnd() {
  const actor = ensureSafeUpdateActor();
  if (!actor) return;
  const phase = resolvePhase(actor.getSnapshot());
  if (phase === "applying") return;
  actor.send({ type: "CHECK_COMPLETED" });
}

export function markUpdateCheckError(detail: string) {
  const actor = ensureSafeUpdateActor();
  if (!actor) return;
  const phase = resolvePhase(actor.getSnapshot());
  if (phase === "applying") return;
  actor.send({ type: "CHECK_FAILED", detail });
}
