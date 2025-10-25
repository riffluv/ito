import { logSafeUpdateTelemetry } from "@/lib/telemetry/safeUpdate";

type UpdateListener = (registration: ServiceWorkerRegistration | null) => void;

const listeners = new Set<UpdateListener>();

export type ApplyServiceWorkerOptions = {
  reason?: string;
  safeMode?: boolean;
};

let waitingRegistration: ServiceWorkerRegistration | null = null;
let pendingReload = false;
let pendingApplyContext: ApplyServiceWorkerOptions | null = null;
let autoApplySuppressed = false;

export function subscribeToServiceWorkerUpdates(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener(waitingRegistration);
  return () => {
    listeners.delete(listener);
  };
}

export function announceServiceWorkerUpdate(registration: ServiceWorkerRegistration | null) {
  waitingRegistration = registration;
  listeners.forEach((listener) => {
    try {
      listener(waitingRegistration);
    } catch {
      /* ignore listener errors to avoid breaking others */
    }
  });
}

export function getWaitingServiceWorker(): ServiceWorkerRegistration | null {
  return waitingRegistration;
}

export function applyServiceWorkerUpdate(
  options?: ApplyServiceWorkerOptions
): boolean {
  const reason = options?.reason ?? "manual";
  const safeMode = options?.safeMode === true;
  const isAutomatic = reason !== "manual";
  if (autoApplySuppressed && isAutomatic) {
    logSafeUpdateTelemetry("suppressed", { reason, safeMode });
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[sw] auto-apply suppressed", { reason });
    }
    return false;
  }
  if (!waitingRegistration?.waiting) {
    logSafeUpdateTelemetry("no_waiting", { reason, safeMode });
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[sw] no waiting service worker to apply", { reason });
    }
    return false;
  }
  try {
    pendingReload = true;
    pendingApplyContext = { reason, safeMode };
    waitingRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    logSafeUpdateTelemetry("triggered", { reason, safeMode });
    return true;
  } catch {
    pendingReload = false;
    pendingApplyContext = null;
    logSafeUpdateTelemetry("failure", { reason, safeMode });
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[sw] applying service worker failed", { reason });
    }
    return false;
  }
}

export function consumePendingReloadFlag(): boolean {
  if (!pendingReload) {
    return false;
  }
  pendingReload = false;
  return true;
}

export function consumePendingApplyContext(): ApplyServiceWorkerOptions | null {
  const context = pendingApplyContext;
  pendingApplyContext = null;
  return context;
}

export function suppressAutoApply() {
  autoApplySuppressed = true;
}

export function clearAutoApplySuppression() {
  autoApplySuppressed = false;
}

export function isAutoApplySuppressed(): boolean {
  return autoApplySuppressed;
}

export function clearWaitingServiceWorker() {
  waitingRegistration = null;
  announceServiceWorkerUpdate(null);
}
