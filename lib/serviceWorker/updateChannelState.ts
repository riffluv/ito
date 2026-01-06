import type { SafeUpdateSnapshot } from "./safeUpdateMachine";

export type UpdateListener = (
  registration: ServiceWorkerRegistration | null
) => void;
export type SnapshotListener = (snapshot: SafeUpdateSnapshot) => void;

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

export function getCurrentWaitingRegistration(): ServiceWorkerRegistration | null {
  return currentWaitingRegistration;
}

export function setCurrentWaitingRegistration(
  registration: ServiceWorkerRegistration | null
) {
  currentWaitingRegistration = registration;
}

export function getCurrentSnapshot(): SafeUpdateSnapshot {
  return currentSnapshot;
}

export function setCurrentSnapshot(snapshot: SafeUpdateSnapshot) {
  currentSnapshot = snapshot;
}

export function addUpdateListener(listener: UpdateListener) {
  updateListeners.add(listener);
}

export function removeUpdateListener(listener: UpdateListener) {
  updateListeners.delete(listener);
}

export function addSnapshotListener(listener: SnapshotListener) {
  snapshotListeners.add(listener);
}

export function removeSnapshotListener(listener: SnapshotListener) {
  snapshotListeners.delete(listener);
}

export function notifyUpdateChannelListeners(snapshot: SafeUpdateSnapshot) {
  snapshotListeners.forEach((listener) => {
    try {
      listener({ ...snapshot });
    } catch {
      /* ignore */
    }
  });

  const registration = currentWaitingRegistration;
  updateListeners.forEach((listener) => {
    try {
      listener(registration);
    } catch {
      /* ignore */
    }
  });
}

