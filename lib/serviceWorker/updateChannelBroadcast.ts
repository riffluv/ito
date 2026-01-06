import { traceAction } from "@/lib/utils/trace";
import { normalizeHoldReason, type SafeUpdateEvent } from "./safeUpdateMachine";

type ActorLike = {
  send: (event: SafeUpdateEvent) => void;
};

export function attachUpdateChannelBroadcastListener(params: {
  broadcast: BroadcastChannel;
  ensureActor: () => ActorLike | null;
  resyncWaitingServiceWorker: (source?: string) => Promise<void>;
}) {
  const { broadcast, ensureActor, resyncWaitingServiceWorker } = params;

  const onMessage = (event: MessageEvent) => {
    const data = (event as MessageEvent<unknown>).data;
    if (!data || typeof data !== "object") {
      return;
    }
    void handleBroadcastMessage(
      data as { type?: string; detail?: string },
      ensureActor,
      resyncWaitingServiceWorker
    );
  };

  broadcast.addEventListener("message", onMessage);
}

async function handleBroadcastMessage(
  message: { type?: string; detail?: string },
  ensureActor: () => ActorLike | null,
  resyncWaitingServiceWorker: (source?: string) => Promise<void>
) {
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
      actor.send({
        type: "WAITING_CLEARED",
        result: "manual",
        source: "broadcast",
        broadcast: false,
      });
      break;
    case "update-applied":
      actor.send({ type: "APPLY_SUCCESS", broadcast: false });
      actor.send({
        type: "WAITING_CLEARED",
        result: "activated",
        source: "broadcast",
        broadcast: false,
      });
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

