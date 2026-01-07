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
import { ensureSafeUpdateActor } from "./updateChannelRuntime";
import type { SafeUpdateSnapshot } from "./safeUpdateMachine";

export function subscribeToServiceWorkerUpdates(
  listener: UpdateListener
): () => void {
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

export function subscribeToSafeUpdateSnapshot(
  listener: SnapshotListener
): () => void {
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

