import { assign, fromCallback, fromPromise, setup, type ActorRefFrom, type StateFrom } from "xstate";

import type {
  SpectatorSessionContext,
  SpectatorSessionEvent,
  SpectatorSessionOptions,
  SpectatorSessionServices,
  SpectatorSessionStatus,
} from "./types";

const defaultContext: SpectatorSessionContext = {
  roomId: null,
  sessionId: null,
  viewerUid: null,
  inviteId: null,
  status: "idle",
  mode: null,
  error: null,
  rejoinSnapshot: null,
  flags: {},
  telemetry: {},
  pendingInviteId: null,
};

const noop = async () => {};

type ConsumeInviteActorInput = {
  inviteId: string | null;
  roomId: string | null;
  viewerUid?: string | null;
};

type ObserveRejoinSnapshotInput = {
  sessionId: string | null;
  roomId: string | null;
};

function resolveServices(options?: SpectatorSessionOptions): Required<SpectatorSessionServices> {
  const merged = options?.services ?? {};
  return {
    consumeInvite: merged.consumeInvite ?? (async () => ({ sessionId: "", mode: "private", inviteId: null })),
    startWatching: merged.startWatching ?? noop,
    requestRejoin: merged.requestRejoin ?? noop,
    cancelRejoin: merged.cancelRejoin ?? noop,
    endSession: merged.endSession ?? noop,
    observeRejoinSnapshot:
      merged.observeRejoinSnapshot ??
      (() => {
        return () => {};
      }),
    approveRejoin: merged.approveRejoin ?? noop,
    rejectRejoin: merged.rejectRejoin ?? noop,
  };
}

export function createSpectatorSessionMachine(options?: SpectatorSessionOptions) {
  const resolvedServices = resolveServices(options);
  const manualInviteResolution = options?.manualInviteResolution ?? false;
  const manualRejoinObservation = options?.manualRejoinObservation ?? false;

  return setup({
    types: {
      context: {} as SpectatorSessionContext,
      events: {} as SpectatorSessionEvent,
    },
    actors: {
      consumeInvite: fromPromise(async ({ input }) => {
        const payload = input as ConsumeInviteActorInput;
        const inviteId = payload?.inviteId ?? null;
        const roomId = payload?.roomId ?? null;
        if (!inviteId) {
          throw new Error("missing-invite");
        }
        if (!roomId) {
          throw new Error("missing-room");
        }
        return resolvedServices.consumeInvite({
          inviteId,
          roomId,
          viewerUid: payload?.viewerUid ?? undefined,
        });
      }),
      observeRejoinSnapshot: fromCallback(({ input, sendBack }) => {
        let unsub: (() => void) | undefined;
        let cancelled = false;

        const begin = (payload: ObserveRejoinSnapshotInput | undefined) => {
          const sessionId = payload?.sessionId ?? null;
          const roomId = payload?.roomId ?? null;
          if (!sessionId) {
            if (cancelled) {
              return;
            }
            const timer = setTimeout(() => {
              begin(payload);
            }, 30);
            unsub = () => {
              clearTimeout(timer);
            };
            return;
          }
          unsub = resolvedServices.observeRejoinSnapshot({
            sessionId,
            roomId: roomId ?? "",
            onSnapshot: (snapshot) => {
              sendBack({ type: "REJOIN_SNAPSHOT", snapshot });
            },
            onError: (error) => {
              sendBack({ type: "SESSION_ERROR", error });
            },
          });
        };

        begin(input as ObserveRejoinSnapshotInput | undefined);

        return () => {
          cancelled = true;
          unsub?.();
        };
      }),
    },
    actions: {
      assignInviteSuccess: assign(({ context, event }) => {
        const payload =
          event.type === "done.invoke.consumeInvite"
            ? event.data
            : event.type === "INVITE_CONSUME_SUCCESS"
            ? event.result
            : null;
        if (!payload) {
          return context;
        }
        const flags = payload.flags ? { ...context.flags, ...payload.flags } : context.flags;
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
      }),
      assignInviteFailure: assign(({ context, event }) => {
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
        return {
          ...context,
          error: message ?? "invite-rejected",
          status: "invitationRejected" as SpectatorSessionStatus,
          pendingInviteId: null,
        };
      }),
      setRejoinPendingStatus: assign(({ context }) => ({
        ...context,
        status: "rejoinPending" as SpectatorSessionStatus,
        error: null,
        rejoinSnapshot: null,
      })),
      setRejoinApprovedStatus: assign(({ context }) => ({
        ...context,
        status: "rejoinApproved" as SpectatorSessionStatus,
        error: null,
      })),
      setRejoinRejectedStatus: assign(({ context }) => ({
        ...context,
        status: "rejoinRejected" as SpectatorSessionStatus,
      })),
      setEndedStatus: assign(({ context }) => ({
        ...context,
        status: "ended" as SpectatorSessionStatus,
      })),
      assignRejoinSnapshotAccepted: assign(({ context, event }) => {
        if (event.type !== "REJOIN_SNAPSHOT" || !event.snapshot) {
          return context;
        }
        return {
          ...context,
          rejoinSnapshot: event.snapshot,
          error: null,
        };
      }),
      assignRejoinSnapshotRejected: assign(({ context, event }) => {
        if (
          event.type !== "REJOIN_SNAPSHOT" ||
          !event.snapshot ||
          event.snapshot?.status !== "rejected"
        ) {
          return context;
        }
        return {
          ...context,
          rejoinSnapshot: event.snapshot,
          error: event.snapshot.reason ?? null,
        };
      }),
      assignRejoinSnapshotPending: assign(({ context, event }) => {
        if (event.type !== "REJOIN_SNAPSHOT") {
          return context;
        }
        return {
          ...context,
          rejoinSnapshot: event.snapshot,
          error: null,
        };
      }),
      startWatchingSession: ({ context }) => {
        if (!context.sessionId) {
          return;
        }
        void resolvedServices.startWatching({ sessionId: context.sessionId!, roomId: context.roomId! }).catch(() => {
          // 上位で SESSION_ERROR にフォールバックするため、ここでは握り潰す
        });
      },
      requestRejoinSession: ({ context, event }) => {
        if (!context.sessionId || event.type !== "REQUEST_REJOIN") {
          return;
        }
        void resolvedServices.requestRejoin({
          sessionId: context.sessionId!,
          roomId: context.roomId!,
          source: event.source,
        }).catch(() => {
          // エラー時は observeRejoinSnapshot 経由で SESSION_ERROR を受け取る前提
        });
      },
      startJoinAsPlayer: ({ context }) => {
        if (!context.sessionId) return;
        void resolvedServices.cancelRejoin({ sessionId: context.sessionId!, roomId: context.roomId! }).catch(() => {
          // best-effort
        });
      },
      endSpectatorSession: ({ context, event }) => {
        const sessionId = context.sessionId;
        if (!sessionId) return;
        const reason = event.type === "SESSION_END" ? event.reason : undefined;
        void resolvedServices.endSession({ sessionId, roomId: context.roomId!, reason }).catch(() => {
          // best-effort
        });
      },
    },
    guards: {
      isRejoinSnapshotAccepted: ({ context, event }) => {
        const snapshot =
          event?.type === "REJOIN_SNAPSHOT" && event.snapshot ? event.snapshot : context.rejoinSnapshot;
        return !!snapshot && snapshot.status === "accepted";
      },
      isRejoinSnapshotRejected: ({ context, event }) => {
        const snapshot =
          event?.type === "REJOIN_SNAPSHOT" && event.snapshot ? event.snapshot : context.rejoinSnapshot;
        return !!snapshot && snapshot.status === "rejected";
      },
      isContextRejoinSnapshotAccepted: ({ context }) => context.rejoinSnapshot?.status === "accepted",
      isContextRejoinSnapshotRejected: ({ context }) => context.rejoinSnapshot?.status === "rejected",
    },
  }).createMachine({
    id: "spectatorSession",
    context: () => ({ ...defaultContext }),
    initial: "idle",
    states: {
      idle: {
        on: {
          SESSION_INIT: {
            target: "ready",
            actions: assign(({ context, event }) => {
              if (event.type !== "SESSION_INIT") return context;
              return {
                ...context,
                roomId: event.roomId,
                viewerUid: event.viewerUid ?? null,
                error: null,
                status: "idle" as SpectatorSessionStatus,
              };
            }),
          },
        },
      },
      ready: {
        on: {
          INVITE_CONSUME: {
            target: "inviting",
            actions: assign(({ context, event }) => {
              if (event.type !== "INVITE_CONSUME") return context;
              return {
                ...context,
                pendingInviteId: event.inviteId,
                error: null,
                status: "inviting" as SpectatorSessionStatus,
              };
            }),
          },
          RESET: {
            target: "idle",
            actions: assign(({ context }) => {
              void context;
              return { ...defaultContext };
            }),
          },
        },
      },
      inviting: manualInviteResolution
        ? {
            on: {
              INVITE_CONSUME_SUCCESS: {
                target: "watching",
                actions: "assignInviteSuccess",
              },
              INVITE_CONSUME_FAILURE: {
                target: "invitationRejected",
                actions: "assignInviteFailure",
              },
            },
          }
        : {
            invoke: [
              {
                id: "consumeInvite",
                src: "consumeInvite",
                input: ({ context }: { context: SpectatorSessionContext }) => ({
                  inviteId: context.pendingInviteId,
                  roomId: context.roomId,
                  viewerUid: context.viewerUid ?? null,
                }),
                onDone: {
                  target: "watching",
                  actions: "assignInviteSuccess",
                },
                onError: {
                  target: "invitationRejected",
                  actions: "assignInviteFailure",
                },
              },
            ],
            on: {
              INVITE_CONSUME_SUCCESS: {
                target: "watching",
                actions: "assignInviteSuccess",
              },
              INVITE_CONSUME_FAILURE: {
                target: "invitationRejected",
                actions: "assignInviteFailure",
              },
            },
          },
      invitationRejected: {
        on: {
          INVITE_CONSUME: {
            target: "inviting",
            actions: assign(({ context, event }) => {
              if (event.type !== "INVITE_CONSUME") return context;
              return {
                ...context,
                pendingInviteId: event.inviteId,
                error: null,
                status: "inviting" as SpectatorSessionStatus,
              };
            }),
          },
          RESET: {
            target: "idle",
            actions: assign(({ context }) => {
              void context;
              return { ...defaultContext };
            }),
          },
        },
      },
      watching: {
        entry: "startWatchingSession",
        ...(manualRejoinObservation
          ? {}
          : {
              invoke: [
                {
                  id: "observeRejoinSnapshot",
                  src: "observeRejoinSnapshot",
                  input: ({ context }: { context: SpectatorSessionContext }) => ({
                    sessionId: context.sessionId,
                    roomId: context.roomId,
                  }),
                },
              ],
            }),
        on: {
          REQUEST_REJOIN: {
            target: "rejoinPending",
          },
          SESSION_END: {
            target: "ended",
            actions: assign(({ context, event }) => ({
              ...context,
              status: "ended" as SpectatorSessionStatus,
              error: event.reason ?? null,
            })),
          },
          SESSION_ERROR: {
            target: "ended",
            actions: assign(({ context, event }) => ({
              ...context,
              status: "ended" as SpectatorSessionStatus,
              error: event.error instanceof Error ? event.error.message : String(event.error),
            })),
          },
        },
      },
      rejoinPending: {
        entry: ["setRejoinPendingStatus", "requestRejoinSession"],
        on: {
          REJOIN_SNAPSHOT: [
            {
              guard: "isRejoinSnapshotAccepted",
              target: "rejoinApproved",
              actions: "assignRejoinSnapshotAccepted",
            },
            {
              guard: "isRejoinSnapshotRejected",
              target: "rejoinRejected",
              actions: "assignRejoinSnapshotRejected",
            },
            {
              target: undefined,
              actions: "assignRejoinSnapshotPending",
            },
          ],
          REJOIN_ACCEPTED: {
            target: "rejoinApproved",
          },
          REJOIN_REJECTED: {
            target: "rejoinRejected",
            actions: assign(({ context, event }) => ({
              ...context,
              error: event.reason ?? null,
            })),
          },
          SESSION_END: {
            target: "ended",
            actions: assign(({ context, event }) => ({
              ...context,
              error: event.reason ?? null,
            })),
          },
          SESSION_ERROR: {
            target: "ended",
            actions: assign(({ context, event }) => ({
              ...context,
              error: event.error instanceof Error ? event.error.message : String(event.error),
            })),
          },
        },
      },
      rejoinApproved: {
        entry: "setRejoinApprovedStatus",
        exit: "startJoinAsPlayer",
        on: {
          SESSION_END: {
            target: "ended",
          },
          SESSION_ERROR: {
            target: "ended",
            actions: assign(({ context, event }) => ({
              ...context,
              error: event.error instanceof Error ? event.error.message : String(event.error),
            })),
          },
        },
      },
      rejoinRejected: {
        entry: "setRejoinRejectedStatus",
        on: {
          REQUEST_REJOIN: {
            target: "rejoinPending",
          },
          SESSION_END: {
            target: "ended",
            actions: assign(({ context, event }) => ({
              ...context,
              error: event.reason ?? null,
            })),
          },
        },
      },
      ended: {
        entry: ["setEndedStatus", "endSpectatorSession"],
        on: {
          RESET: {
            target: "idle",
            actions: assign(({ context }) => {
              void context;
              return { ...defaultContext };
            }),
          },
        },
      },
    },
  });
}

export type SpectatorSessionActorRef = ActorRefFrom<ReturnType<typeof createSpectatorSessionMachine>>;
export type SpectatorSessionState = StateFrom<ReturnType<typeof createSpectatorSessionMachine>>;
