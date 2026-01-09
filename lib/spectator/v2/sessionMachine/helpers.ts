import type {
  SpectatorRejoinSnapshot,
  SpectatorSessionContext,
  SpectatorSessionEvent,
  SpectatorSessionFlags,
  SpectatorSessionMode,
  SpectatorSessionStatus,
} from "../types";

type InviteConsumeResult = {
  sessionId: string;
  mode: SpectatorSessionMode;
  inviteId: string | null;
  flags?: SpectatorSessionFlags;
};

export function extractInviteConsumeResult(
  event: SpectatorSessionEvent
): InviteConsumeResult | null {
  if (event.type === "done.invoke.consumeInvite") return event.data;
  if (event.type === "INVITE_CONSUME_SUCCESS") return event.result;
  return null;
}

export function applyInviteConsumeSuccess(
  context: SpectatorSessionContext,
  payload: InviteConsumeResult
): SpectatorSessionContext {
  const flags = payload.flags
    ? { ...context.flags, ...payload.flags }
    : context.flags;
  return {
    ...context,
    sessionId: payload.sessionId,
    inviteId: payload.inviteId ?? null,
    mode: payload.mode,
    status: "watching" as SpectatorSessionStatus,
    error: null,
    pendingInviteId: null,
    flags,
  };
}

export function extractInviteConsumeFailureMessage(
  event: SpectatorSessionEvent
): string | null {
  let source: unknown = null;
  if (event.type === "error.platform.consumeInvite" || event.type === "error.actor.consumeInvite") {
    source = event.data;
  } else if (event.type === "INVITE_CONSUME_FAILURE") {
    source = event.error ?? event.reason ?? null;
  }

  let message: string | null = null;
  if (source instanceof Error) {
    message = source.message;
  } else if (typeof source === "string") {
    message = source;
  } else if (source && typeof source === "object" && "message" in (source as Record<string, unknown>)) {
    const derived = (source as Record<string, unknown>).message;
    if (typeof derived === "string") {
      message = derived;
    }
  }
  if (!message && event.type === "INVITE_CONSUME_FAILURE" && typeof event.reason === "string") {
    message = event.reason;
  }
  return message;
}

export function applyInviteConsumeFailure(
  context: SpectatorSessionContext,
  message: string | null
): SpectatorSessionContext {
  return {
    ...context,
    error: message ?? "invite-rejected",
    status: "invitationRejected" as SpectatorSessionStatus,
    pendingInviteId: null,
  };
}

export function pickRejoinSnapshot(params: {
  context: SpectatorSessionContext;
  event: SpectatorSessionEvent;
}): Exclude<SpectatorRejoinSnapshot, null> | null {
  const { context, event } = params;
  const snapshot =
    event?.type === "REJOIN_SNAPSHOT" && event.snapshot ? event.snapshot : context.rejoinSnapshot;
  return snapshot ?? null;
}

export function isRejoinSnapshotStatus(params: {
  context: SpectatorSessionContext;
  event: SpectatorSessionEvent;
  status: Exclude<Exclude<SpectatorRejoinSnapshot, null>, null>["status"];
}): boolean {
  const snapshot = pickRejoinSnapshot({ context: params.context, event: params.event });
  return !!snapshot && snapshot.status === params.status;
}

