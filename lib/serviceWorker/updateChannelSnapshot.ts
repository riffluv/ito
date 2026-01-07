import { traceAction } from "@/lib/utils/trace";
import {
  createSafeUpdateMachine,
  type SafeUpdateEvent,
  type SafeUpdatePhase,
  type SafeUpdateSnapshot,
} from "./safeUpdateMachine";
import {
  getCurrentSnapshot,
  notifyUpdateChannelListeners,
  setCurrentSnapshot,
  setCurrentWaitingRegistration,
} from "./updateChannelState";
import type { StateFrom } from "xstate";

type SafeUpdateSnapshotState = StateFrom<
  ReturnType<typeof createSafeUpdateMachine>
>;

let previousPhase: SafeUpdatePhase = "idle";

export function resolvePhase(state: SafeUpdateSnapshotState): SafeUpdatePhase {
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

export function handleSafeUpdateStateChange(state: SafeUpdateSnapshotState) {
  setCurrentWaitingRegistration(state.context.waitingRegistration ?? null);
  const nextSnapshot = createSnapshot(state);
  const nextPhase = nextSnapshot.phase;
  const eventType =
    ((state as unknown as { event?: SafeUpdateEvent }).event?.type) ?? "INIT";
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
