import { traceError } from "@/lib/utils/trace";
import {
  createInitialContext,
  createSafeUpdateMachine,
  type SafeUpdateContext,
} from "./safeUpdateMachine";
import { createStartApply } from "./updateChannelApply";
import { attachUpdateChannelBroadcastListener } from "./updateChannelBroadcast";
import { handleSafeUpdateStateChange } from "./updateChannelSnapshot";
import { getCurrentSnapshot } from "./updateChannelState";
import { createActor, type ActorRefFrom } from "xstate";

const BROADCAST_CHANNEL_NAME = "ito-safe-update-v1";

const isBrowser =
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator;

const broadcast =
  isBrowser && "BroadcastChannel" in window
    ? new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    : null;

export function now(): number {
  return Date.now();
}

const startApply = createStartApply({
  now,
  broadcast,
  getSnapshot: getCurrentSnapshot,
});

const safeUpdateMachine = createSafeUpdateMachine({
  isBrowser,
  broadcast,
  startApply,
  now,
});

let safeUpdateActor: ActorRefFrom<typeof safeUpdateMachine> | null = null;

export function ensureSafeUpdateActor(): ActorRefFrom<
  typeof safeUpdateMachine
> | null {
  if (safeUpdateActor || !isBrowser) {
    return safeUpdateActor;
  }
  safeUpdateActor = createActor(safeUpdateMachine);
  safeUpdateActor.subscribe(handleSafeUpdateStateChange);
  safeUpdateActor.start();
  void resyncWaitingServiceWorker("actor-init");
  return safeUpdateActor;
}

export function getSafeUpdateContext(): SafeUpdateContext {
  const actor = ensureSafeUpdateActor();
  return actor?.getSnapshot().context ?? createInitialContext();
}

if (broadcast) {
  attachUpdateChannelBroadcastListener({
    broadcast,
    ensureActor: ensureSafeUpdateActor,
    resyncWaitingServiceWorker,
  });
}

export async function resyncWaitingServiceWorker(source?: string): Promise<void> {
  if (!isBrowser) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const actor = ensureSafeUpdateActor();
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

