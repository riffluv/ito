import {
  areAllCluesReady,
  getClueTargetIds,
  getPresenceEligibleIds,
} from "@/lib/game/selectors";
import {
  GameService,
  type ResetRoomKeepIds,
  type ResetRoomOptions,
} from "@/lib/game/service";
import { sanitizePlayer, sanitizeRoom } from "@/lib/state/sanitize";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import {
  assign,
  createMachine,
  fromCallback,
  type ActorRefFrom,
  type StateFrom,
} from "xstate";
import { bumpMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";

type PlayerWithId = (PlayerDoc & { id: string }) | { id: string; ready?: boolean };

export type SpectatorReason = "mid-game" | "waiting-open" | "waiting-closed" | "version-mismatch" | null;
export type SpectatorStatus =
  | "idle"
  | "watching"
  | "requesting"
  | "waiting-host"
  | "approved"
  | "rejected";
export type SpectatorRequestSource = "manual" | "auto" | null;

export type RoomMachineContext = {
  roomId: string;
  viewerUid: string | null;
  room: (RoomDoc & { id?: string }) | null;
  players: PlayerWithId[];
  onlineUids?: string[];
  presenceReady: boolean;
  spectatorStatus: SpectatorStatus;
  spectatorReason: SpectatorReason;
  spectatorRequestSource: SpectatorRequestSource;
  spectatorError: string | null;
  spectatorRequestStatus: "idle" | "pending" | "accepted" | "rejected";
  spectatorRequestCreatedAt: number | null;
  spectatorRequestFailure: string | null;
};

export type RoomMachineClientEvent =
  | { type: "START" }
  | { type: "DEAL_READY" }
  | { type: "SUBMIT_ORDER"; list: string[] }
  | { type: "REVEAL_DONE" }
  | {
      type: "RESET";
      keepIds?: ResetRoomKeepIds;
      options?: ResetRoomOptions;
    }
  | { type: "SPECTATOR_ENTER"; reason: Exclude<SpectatorReason, null> }
  | { type: "SPECTATOR_LEAVE" }
  | { type: "SPECTATOR_REQUEST"; source: Exclude<SpectatorRequestSource, null> }
  | { type: "SPECTATOR_WAIT_HOST" }
  | { type: "SPECTATOR_CANCEL" }
  | { type: "SPECTATOR_APPROVED" }
  | { type: "SPECTATOR_REJECTED"; error?: string | null }
  | { type: "SPECTATOR_TIMEOUT" }
  | { type: "SPECTATOR_ERROR"; error: string }
  | { type: "SPECTATOR_REASON_UPDATE"; reason: SpectatorReason }
  | { type: "SPECTATOR_RESET" }
  | { type: "SPECTATOR_FORCE_EXIT"; reason?: SpectatorReason | null };

export type SpectatorRejoinSnapshot =
  | { exists: false }
  | {
      exists: true;
      status: "pending" | "accepted" | "rejected";
      source: Exclude<SpectatorRequestSource, null>;
      createdAt: number | null;
      failure: string | null;
    };

export type SpectatorRejoinSnapshotEvent = {
  type: "SPECTATOR_REQUEST_SNAPSHOT";
  snapshot: SpectatorRejoinSnapshot;
};

export type RoomMachineEvent = RoomMachineClientEvent | SpectatorRejoinSnapshotEvent;

type RoomMachineInternalEvent =
  | RoomMachineEvent
  | {
      type: "SYNC";
      room: (RoomDoc & { id?: string }) | null;
      players: PlayerWithId[];
      onlineUids?: string[] | null;
      presenceReady?: boolean;
    };

type SubscribeSpectatorRejoinParams = {
  roomId: string;
  uid: string;
  onSnapshot: (snapshot: SpectatorRejoinSnapshot) => void;
  onError?: (error: unknown) => void;
};

type RoomMachineDeps = {
  startGame: typeof GameService.startGame;
  dealNumbers: typeof GameService.dealNumbers;
  submitSortedOrder: typeof GameService.submitSortedOrder;
  finalizeReveal: typeof GameService.finalizeReveal;
  resetRoomWithPrune: typeof GameService.resetRoomWithPrune;
  cancelSeatRequest: typeof GameService.cancelSeatRequest;
  subscribeSpectatorRejoin?: (params: SubscribeSpectatorRejoinParams) => void | (() => void);
};

const defaultDeps: RoomMachineDeps = {
  startGame: GameService.startGame,
  dealNumbers: GameService.dealNumbers,
  submitSortedOrder: GameService.submitSortedOrder,
  finalizeReveal: GameService.finalizeReveal,
  resetRoomWithPrune: GameService.resetRoomWithPrune,
  cancelSeatRequest: GameService.cancelSeatRequest,
  subscribeSpectatorRejoin: undefined,
};

type RoomMachineInput = {
  roomId: string;
  room?: (RoomDoc & { id?: string }) | null;
  players?: PlayerWithId[];
  onlineUids?: string[] | null;
  presenceReady?: boolean;
  viewerUid?: string | null;
  deps?: Partial<RoomMachineDeps>;
};

function sanitizePlayers(players: PlayerWithId[]): PlayerWithId[] {
  return players.map((player) =>
    "id" in player ? sanitizePlayer(player.id, player) : player
  );
}

function computeEligibleIds(context: RoomMachineContext): string[] {
  const baseIds = context.players.map((player) => player.id);
  return getPresenceEligibleIds({
    baseIds,
    onlineUids: context.onlineUids,
    presenceReady: context.presenceReady,
  });
}

function computeTargetIds(context: RoomMachineContext): string[] {
  const eligible = computeEligibleIds(context);
  return getClueTargetIds({
    dealPlayers: context.room?.deal?.players ?? null,
    eligibleIds: eligible,
  });
}

function sanitizeOrderList(values: string[] | undefined | null): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
}

function resolveStatus(room: (RoomDoc & { id?: string }) | null): RoomDoc["status"] {
  return room?.status ?? "waiting";
}

export function createRoomMachine(input: RoomMachineInput) {
  const sanitizedRoom = input.room ? sanitizeRoom(input.room) : null;
  const sanitizedPlayers = sanitizePlayers(input.players ?? []);
  const sanitizedOnline = Array.isArray(input.onlineUids)
    ? [...input.onlineUids]
    : undefined;
  const deps: RoomMachineDeps = { ...defaultDeps, ...input.deps };

  return createMachine(
    {
      id: "roomMachine",
      context: (): RoomMachineContext => ({
        roomId: input.roomId,
        viewerUid: input.viewerUid ?? null,
        room: sanitizedRoom,
        players: sanitizedPlayers,
        onlineUids: sanitizedOnline,
        presenceReady: input.presenceReady ?? false,
        spectatorStatus: "idle",
        spectatorReason: null,
        spectatorRequestSource: null,
        spectatorError: null,
        spectatorRequestStatus: "idle",
        spectatorRequestCreatedAt: null,
        spectatorRequestFailure: null,
      }),
      types: {} as {
        context: RoomMachineContext;
        events: RoomMachineInternalEvent;
      },
      initial: resolveStatus(sanitizedRoom),
      on: {
        SPECTATOR_REQUEST_SNAPSHOT: {
          actions: ["spectatorRequestSnapshot"],
        },
        SPECTATOR_ENTER: {
          actions: ["spectatorEnter"],
        },
        SPECTATOR_LEAVE: {
          actions: ["spectatorLeave"],
        },
        SPECTATOR_REQUEST: {
          actions: ["spectatorRequest"],
        },
        SPECTATOR_WAIT_HOST: {
          actions: ["spectatorWaitHost"],
        },
        SPECTATOR_CANCEL: {
          actions: ["spectatorCancel"],
        },
        SPECTATOR_APPROVED: {
          actions: ["spectatorApproved"],
        },
        SPECTATOR_REJECTED: {
          actions: ["spectatorRejected"],
        },
        SPECTATOR_TIMEOUT: {
          actions: ["spectatorTimeout"],
        },
        SPECTATOR_ERROR: {
          actions: ["spectatorError"],
        },
        SPECTATOR_REASON_UPDATE: {
          actions: ["spectatorReasonUpdate"],
        },
        SPECTATOR_RESET: {
          actions: ["spectatorReset"],
        },
        SPECTATOR_FORCE_EXIT: {
          actions: ["spectatorForceExit", "spectatorForceExitCleanup"],
        },
      },
      invoke: [
        {
          src: "spectatorRejoinListener",
          input: ({ context }) => ({
            roomId: context.roomId,
            viewerUid: context.viewerUid,
          }),
        },
      ],
      states: {
        waiting: {
          on: {
            START: {
              guard: "canStart",
              target: "clue",
              actions: ["markClue", "callStartGame"],
            },
            RESET: {
              actions: "callReset",
            },
            SYNC: [
              {
                guard: "syncToWaiting",
                actions: "assignSnapshot",
              },
              {
                guard: "syncToClue",
                target: "clue",
                actions: "assignSnapshot",
              },
              {
                guard: "syncToReveal",
                target: "reveal",
                actions: "assignSnapshot",
              },
              {
                guard: "syncToFinished",
                target: "finished",
                actions: "assignSnapshot",
              },
              {
                actions: "assignSnapshot",
              },
            ],
          },
        },
        clue: {
          on: {
            DEAL_READY: {
              guard: "canDeal",
              actions: "callDealNumbers",
            },
            SUBMIT_ORDER: {
              guard: "canSubmitOrder",
              target: "reveal",
              actions: ["markReveal", "callSubmitOrder"],
            },
            RESET: {
              target: "waiting",
              actions: ["markWaiting", "callReset"],
            },
            SYNC: [
              {
                guard: "syncToWaiting",
                target: "waiting",
                actions: "assignSnapshot",
              },
              {
                guard: "syncToReveal",
                target: "reveal",
                actions: "assignSnapshot",
              },
              {
                guard: "syncToFinished",
                target: "finished",
                actions: "assignSnapshot",
              },
              {
                actions: "assignSnapshot",
              },
            ],
          },
        },
        reveal: {
          on: {
            REVEAL_DONE: {
              target: "finished",
              actions: ["markFinished", "callFinalizeReveal"],
            },
            RESET: {
              target: "waiting",
              actions: ["markWaiting", "callReset"],
            },
            SYNC: [
              {
                guard: "syncToWaiting",
                target: "waiting",
                actions: "assignSnapshot",
              },
              {
                guard: "syncToClue",
                target: "clue",
                actions: "assignSnapshot",
              },
              {
                guard: "syncToFinished",
                target: "finished",
                actions: "assignSnapshot",
              },
              {
                actions: "assignSnapshot",
              },
            ],
          },
        },
        finished: {
          on: {
            RESET: {
              target: "waiting",
              actions: ["markWaiting", "callReset"],
            },
            SYNC: [
              {
                guard: "syncToWaiting",
                target: "waiting",
                actions: "assignSnapshot",
              },
              {
                guard: "syncToClue",
                target: "clue",
                actions: "assignSnapshot",
              },
              {
                guard: "syncToReveal",
                target: "reveal",
                actions: "assignSnapshot",
              },
              {
                actions: "assignSnapshot",
              },
            ],
          },
        },
      },
    },
    {
      actions: {
        assignSnapshot: assign(({ context, event }) => {
          if (event.type !== "SYNC") {
            return context;
          }
          const nextRoom = event.room ? sanitizeRoom(event.room) : null;
          return {
            ...context,
            room: nextRoom,
            players: sanitizePlayers(event.players ?? []),
            onlineUids: Array.isArray(event.onlineUids)
              ? [...event.onlineUids]
              : undefined,
            presenceReady: event.presenceReady ?? context.presenceReady,
          };
        }),
        spectatorRequestSnapshot: assign(({ context, event }) => {
          if (event.type !== "SPECTATOR_REQUEST_SNAPSHOT") {
            return context;
          }
          if (!event.snapshot.exists) {
            const shouldResetToWatching =
              context.spectatorStatus === "waiting-host" ||
              context.spectatorStatus === "approved" ||
              context.spectatorStatus === "rejected";
            const nextStatus: SpectatorStatus = shouldResetToWatching
              ? "watching"
              : context.spectatorStatus;
            return {
              ...context,
              spectatorStatus: nextStatus,
              spectatorRequestStatus: "idle" as const,
              spectatorRequestSource: null,
              spectatorRequestCreatedAt: null,
              spectatorRequestFailure: null,
              spectatorError: nextStatus === "watching" ? null : context.spectatorError,
            };
          }
          const snapshot = event.snapshot;
          const source = snapshot.source ?? context.spectatorRequestSource ?? "manual";
          const previousStatus = context.spectatorRequestStatus;
          let spectatorStatus: SpectatorStatus = context.spectatorStatus;
          let spectatorError = context.spectatorError;
          switch (snapshot.status) {
            case "pending":
              spectatorStatus =
                context.spectatorStatus === "idle" ? "watching" : "waiting-host";
              spectatorError = null;
              break;
            case "accepted":
              spectatorStatus = "approved";
              spectatorError = null;
              break;
            case "rejected":
              spectatorStatus = "rejected";
              spectatorError = snapshot.failure ?? context.spectatorError;
              break;
            default:
              break;
          }
          if (previousStatus !== snapshot.status) {
            const uid = context.viewerUid ?? undefined;
            if (snapshot.status === "accepted") {
              traceAction("spectator.recallAccepted", { roomId: context.roomId, uid });
              bumpMetric("recall", "accepted");
            } else if (snapshot.status === "rejected") {
              traceAction("spectator.recallRejected", { roomId: context.roomId, uid });
              bumpMetric("recall", "rejected");
            }
          }
          return {
            ...context,
            spectatorStatus,
            spectatorRequestStatus: snapshot.status,
            spectatorRequestSource: source,
            spectatorRequestCreatedAt: snapshot.createdAt ?? null,
            spectatorRequestFailure: snapshot.failure ?? null,
            spectatorError,
          };
        }),
        markClue: assign(({ context }) => {
          if (!context.room) return context;
          return {
            ...context,
            room: { ...context.room, status: "clue" as const },
          };
        }),
        markReveal: assign(({ context }) => {
          if (!context.room) return context;
          return {
            ...context,
            room: { ...context.room, status: "reveal" as const },
          };
        }),
        markFinished: assign(({ context }) => {
          if (!context.room) return context;
          return {
            ...context,
            room: { ...context.room, status: "finished" as const },
          };
        }),
        markWaiting: assign(({ context }) => {
          if (!context.room) return context;
          return {
            ...context,
            room: { ...context.room, status: "waiting" as const },
          };
        }),
        callStartGame: ({ context }) => {
          void deps.startGame(context.roomId).catch(() => {});
        },
        callDealNumbers: ({ context }) => {
          void deps.dealNumbers(context.roomId).catch(() => {});
        },
        callSubmitOrder: ({ context, event }) => {
          if (event.type !== "SUBMIT_ORDER") return;
          const list = sanitizeOrderList(event.list);
          void deps.submitSortedOrder(context.roomId, list).catch(() => {});
        },
        callFinalizeReveal: ({ context }) => {
          void deps.finalizeReveal(context.roomId).catch(() => {});
        },
        callReset: ({ context, event }) => {
          if (event.type !== "RESET") return;
          void deps
            .resetRoomWithPrune(context.roomId, event.keepIds, event.options)
            .catch(() => {});
        },
        spectatorEnter: assign(({ context, event }) => {
          if (event.type !== "SPECTATOR_ENTER") return context;
          return {
            ...context,
            spectatorStatus: "watching" as const,
            spectatorReason: event.reason ?? null,
            spectatorRequestSource: null,
            spectatorError: null,
            spectatorRequestStatus: "idle" as const,
            spectatorRequestCreatedAt: null,
            spectatorRequestFailure: null,
          };
        }),
        spectatorLeave: assign(({ context }) => ({
          ...context,
          spectatorStatus: "idle" as const,
          spectatorReason: null,
          spectatorRequestSource: null,
          spectatorError: null,
          spectatorRequestStatus: "idle" as const,
          spectatorRequestCreatedAt: null,
          spectatorRequestFailure: null,
        })),
        spectatorRequest: assign(({ context, event }) => {
          if (event.type !== "SPECTATOR_REQUEST") return context;
          return {
            ...context,
            spectatorStatus: "requesting" as const,
            spectatorRequestSource: event.source,
            spectatorError: null,
            spectatorRequestStatus: "pending" as const,
          };
        }),
        spectatorWaitHost: assign(({ context }) => ({
          ...context,
          spectatorStatus: "waiting-host" as const,
          spectatorRequestStatus: "pending" as const,
        })),
        spectatorCancel: assign(({ context }) => ({
          ...context,
          spectatorStatus: "watching" as const,
          spectatorRequestSource: null,
          spectatorError: null,
          spectatorRequestStatus: "idle" as const,
          spectatorRequestCreatedAt: null,
          spectatorRequestFailure: null,
        })),
        spectatorApproved: assign(({ context }) => ({
          ...context,
          spectatorStatus: "approved" as const,
          spectatorRequestSource: null,
          spectatorError: null,
          spectatorRequestStatus: "accepted" as const,
        })),
        spectatorRejected: assign(({ context, event }) => {
          const error =
            event.type === "SPECTATOR_REJECTED"
              ? event.error ?? null
              : context.spectatorError;
          return {
            ...context,
            spectatorStatus: "rejected" as const,
            spectatorRequestSource: null,
            spectatorError: error,
            spectatorRequestStatus: "rejected" as const,
            spectatorRequestFailure: error,
          };
        }),
        spectatorTimeout: assign(({ context }) => {
          const uid = context.viewerUid ?? undefined;
          traceAction("spectator.recallTimeout", { roomId: context.roomId, uid });
          bumpMetric("recall", "timeout");
          return {
            ...context,
            spectatorStatus: "watching" as const,
            spectatorRequestSource: null,
            spectatorError: null,
            spectatorRequestStatus: "idle" as const,
            spectatorRequestFailure: null,
          };
        }),
        spectatorError: assign(({ context, event }) => {
          if (event.type !== "SPECTATOR_ERROR") return context;
          const resetRequest =
            context.spectatorRequestStatus === "pending" ||
            context.spectatorRequestStatus === "accepted" ||
            context.spectatorRequestStatus === "rejected";
          return {
            ...context,
            spectatorStatus:
              context.spectatorStatus === "idle" ? "idle" : "watching",
            spectatorRequestStatus: resetRequest ? "idle" : context.spectatorRequestStatus,
            spectatorRequestSource: resetRequest ? null : context.spectatorRequestSource,
            spectatorRequestCreatedAt: resetRequest ? null : context.spectatorRequestCreatedAt,
            spectatorRequestFailure: resetRequest ? null : context.spectatorRequestFailure,
            spectatorError: event.error,
          };
        }),
        spectatorReasonUpdate: assign(({ context, event }) => {
          if (event.type !== "SPECTATOR_REASON_UPDATE") return context;
          return {
            ...context,
            spectatorReason: event.reason,
          };
        }),
        spectatorReset: assign(({ context }) => ({
          ...context,
          spectatorStatus: "idle" as const,
          spectatorReason: null,
          spectatorRequestSource: null,
          spectatorError: null,
          spectatorRequestStatus: "idle" as const,
          spectatorRequestCreatedAt: null,
          spectatorRequestFailure: null,
        })),
        spectatorForceExit: assign(({ context, event }) => {
          if (event.type !== "SPECTATOR_FORCE_EXIT") return context;
          return {
            ...context,
            spectatorStatus: "idle" as const,
            spectatorReason: event.reason ?? null,
            spectatorRequestSource: null,
            spectatorError: null,
            spectatorRequestStatus: "idle" as const,
            spectatorRequestCreatedAt: null,
            spectatorRequestFailure: null,
          };
        }),
        spectatorForceExitCleanup: ({ context, event, self }) => {
          if (event.type !== "SPECTATOR_FORCE_EXIT") return;
          const uid = context.viewerUid;
          traceAction("spectator.forceExit", {
            roomId: context.roomId,
            uid,
            reason: event.reason ?? null,
          });
          if (!uid) return;
          void (async () => {
            try {
              await deps.cancelSeatRequest(context.roomId, uid);
            } catch (error) {
              traceError("spectator.forceExit.cancel", error as any, {
                roomId: context.roomId,
                uid,
              });
              const message =
                error instanceof Error
                  ? error.message
                  : typeof error === "string"
                  ? error
                  : (() => {
                      try {
                        return JSON.stringify(error);
                      } catch {
                        return "unknown";
                      }
                    })();
              self.send({ type: "SPECTATOR_ERROR", error: message ?? "unknown" });
            }
          })();
        },
      },
      actors: {
        spectatorRejoinListener: fromCallback(({ input, sendBack }) => {
          const payload = input as { roomId?: string; viewerUid?: string | null } | undefined;
          const subscribe = deps.subscribeSpectatorRejoin;
          const roomId = payload?.roomId ?? null;
          const uid = payload?.viewerUid ?? null;
          if (typeof subscribe !== "function" || !roomId || !uid) {
            return () => {};
          }
          const unsubscribe = subscribe({
            roomId,
            uid,
            onSnapshot: (snapshot) => {
              sendBack({ type: "SPECTATOR_REQUEST_SNAPSHOT", snapshot });
            },
            onError: (error) => {
              const message =
                error instanceof Error
                  ? error.message
                  : typeof error === "string"
                  ? error
                  : JSON.stringify(error);
              sendBack({
                type: "SPECTATOR_ERROR",
                error: message ?? "unknown",
              });
            },
          });
          return () => {
            if (typeof unsubscribe === "function") {
              unsubscribe();
            }
          };
        }),
      },
      guards: {
        canStart: ({ context }) => computeTargetIds(context).length >= 2,
        canDeal: ({ context }) => computeTargetIds(context).length >= 2,
        canSubmitOrder: ({ context, event }) => {
          if (event.type !== "SUBMIT_ORDER") return false;
          const list = sanitizeOrderList(event.list);
          if (list.length < 2) return false;
          const unique = new Set(list);
          if (unique.size !== list.length) return false;
          const targets = computeTargetIds(context);
          if (targets.length < 2) return false;
          const subset = list.every((id) => targets.includes(id));
          if (!subset) return false;
          return areAllCluesReady({
            players: context.players,
            targetIds: targets,
          });
        },
        syncToWaiting: ({ event }) =>
          event.type === "SYNC" && resolveStatus(event.room ?? null) === "waiting",
        syncToClue: ({ event }) =>
          event.type === "SYNC" && resolveStatus(event.room ?? null) === "clue",
        syncToReveal: ({ event }) =>
          event.type === "SYNC" && resolveStatus(event.room ?? null) === "reveal",
        syncToFinished: ({ event }) =>
          event.type === "SYNC" && resolveStatus(event.room ?? null) === "finished",
      },
    }
  );
}

export type RoomMachine = ReturnType<typeof createRoomMachine>;
export type RoomMachineActorRef = ActorRefFrom<RoomMachine>;
export type RoomMachineSnapshot = StateFrom<RoomMachine>;
