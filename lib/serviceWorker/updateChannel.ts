type UpdateListener = (registration: ServiceWorkerRegistration | null) => void;

const listeners = new Set<UpdateListener>();

let waitingRegistration: ServiceWorkerRegistration | null = null;
let pendingReload = false;

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

export function applyServiceWorkerUpdate(): boolean {
  if (!waitingRegistration?.waiting) {
    return false;
  }
  try {
    pendingReload = true;
    waitingRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    return true;
  } catch {
    pendingReload = false;
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

export function clearWaitingServiceWorker() {
  waitingRegistration = null;
  announceServiceWorkerUpdate(null);
}
