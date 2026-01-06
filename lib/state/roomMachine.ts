import { areAllCluesReady } from "@/lib/game/selectors";
import {
  GameService,
  type ResetRoomKeepIds,
  type ResetRoomOptions,
} from "@/lib/game/service";
import { sanitizeRoom } from "@/lib/state/sanitize";
import type { RoomDoc } from "@/lib/types";
import {
  assign,
  createMachine,
  fromCallback,
  type ActorRefFrom,
  type StateFrom,
} from "xstate";
import { bumpMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { handleGameError } from "@/lib/utils/errorHandling";
// NOTE: Safe Update の hold/release は useRoomMachineController でページ単位で管理するため、
// roomMachine からのフェーズ別制御は削除。部屋にいる間は waiting 含め常に hold される。

import {
  recordRoomMetrics,
  resolveStatus,
  sanitizeOrderList,
  sanitizePlayers,
  type PlayerWithId,
  type SanitizedPlayer,
} from "./roomMachineUtils";
import { computeTargetIds } from "./roomMachineDerivations";

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
  players: SanitizedPlayer[];
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

export function createRoomMachine(input: RoomMachineInput) {
  const sanitizedRoom = input.room ? sanitizeRoom(input.room) : null;
  const sanitizedPlayers = sanitizePlayers(input.players ?? []);
  const sanitizedOnline = Array.isArray(input.onlineUids)
    ? [...input.onlineUids]
    : undefined;
  const deps: RoomMachineDeps = { ...defaultDeps, ...input.deps };

  const reportActionError = (action: string, error: unknown) => {
    traceError(`room.${action}`, error, { roomId: input.roomId });
    if (typeof window !== "undefined") {
      handleGameError(error, `ルーム操作: ${action}`, true);
    }
  };

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
      type: "parallel",
      on: {
        SPECTATOR_REQUEST_SNAPSHOT: [
          {
            guard: "snapshotIsPendingWaitingHost",
            target: "#roomMachine.spectator.waiting-host",
            actions: ["spectatorRequestSnapshot"],
          },
          {
            guard: "snapshotIsPendingWatching",
            target: "#roomMachine.spectator.watching",
            actions: ["spectatorRequestSnapshot"],
          },
          {
            guard: "snapshotIsAccepted",
            target: "#roomMachine.spectator.approved",
            actions: ["spectatorRequestSnapshot"],
          },
          {
            guard: "snapshotIsRejected",
            target: "#roomMachine.spectator.rejected",
            actions: ["spectatorRequestSnapshot"],
          },
          {
            guard: "snapshotClearsToWatching",
            target: "#roomMachine.spectator.watching",
            actions: ["spectatorRequestSnapshot"],
          },
          {
            actions: ["spectatorRequestSnapshot"],
          },
        ],
        SPECTATOR_ENTER: {
          target: "#roomMachine.spectator.watching",
          actions: ["spectatorEnter"],
        },
        SPECTATOR_LEAVE: {
          target: "#roomMachine.spectator.idle",
          actions: ["spectatorLeave"],
        },
        SPECTATOR_REQUEST: {
          target: "#roomMachine.spectator.requesting",
          actions: ["spectatorRequest"],
        },
        SPECTATOR_WAIT_HOST: {
          target: "#roomMachine.spectator.waiting-host",
          actions: ["spectatorWaitHost"],
        },
        SPECTATOR_CANCEL: {
          target: "#roomMachine.spectator.watching",
          actions: ["spectatorCancel"],
        },
        SPECTATOR_APPROVED: {
          target: "#roomMachine.spectator.approved",
          actions: ["spectatorApproved"],
        },
        SPECTATOR_REJECTED: {
          target: "#roomMachine.spectator.rejected",
          actions: ["spectatorRejected"],
        },
        SPECTATOR_TIMEOUT: {
          target: "#roomMachine.spectator.watching",
          actions: ["spectatorTimeout"],
        },
        SPECTATOR_ERROR: {
          actions: ["spectatorError"],
        },
        SPECTATOR_REASON_UPDATE: {
          actions: ["spectatorReasonUpdate"],
        },
        SPECTATOR_RESET: {
          target: "#roomMachine.spectator.idle",
          actions: ["spectatorReset"],
        },
        SPECTATOR_FORCE_EXIT: {
          target: "#roomMachine.spectator.watching",
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
        phase: {
          initial: resolveStatus(sanitizedRoom),
          states: {
            waiting: {
              // NOTE: Safe Update の hold/release は useRoomMachineController でページ単位で管理
              on: {
        START: {
          guard: "canStart",
          target: "#roomMachine.phase.clue",
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
                    target: "#roomMachine.phase.clue",
                    actions: "assignSnapshot",
                  },
                  {
                    guard: "syncToReveal",
                    target: "#roomMachine.phase.reveal",
                    actions: "assignSnapshot",
                  },
                  {
                    guard: "syncToFinished",
                    target: "#roomMachine.phase.finished",
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
                  target: "#roomMachine.phase.reveal",
                  actions: ["markReveal", "callSubmitOrder"],
                },
                RESET: {
                  target: "#roomMachine.phase.waiting",
                  actions: ["markWaiting", "callReset"],
                },
                SYNC: [
                  {
                    guard: "syncToWaiting",
                    target: "#roomMachine.phase.waiting",
                    actions: "assignSnapshot",
                  },
                  {
                    guard: "syncToReveal",
                    target: "#roomMachine.phase.reveal",
                    actions: "assignSnapshot",
                  },
                  {
                    guard: "syncToFinished",
                    target: "#roomMachine.phase.finished",
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
                  target: "#roomMachine.phase.finished",
                  actions: ["markFinished", "callFinalizeReveal"],
                },
                RESET: {
                  target: "#roomMachine.phase.waiting",
                  actions: ["markWaiting", "callReset"],
                },
                SYNC: [
                  {
                    guard: "syncToWaiting",
                    target: "#roomMachine.phase.waiting",
                    actions: "assignSnapshot",
                  },
                  {
                    guard: "syncToClue",
                    target: "#roomMachine.phase.clue",
                    actions: "assignSnapshot",
                  },
                  {
                    guard: "syncToFinished",
                    target: "#roomMachine.phase.finished",
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
                  target: "#roomMachine.phase.waiting",
                  actions: ["markWaiting", "callReset"],
                },
                SYNC: [
                  {
                    guard: "syncToWaiting",
                    target: "#roomMachine.phase.waiting",
                    actions: "assignSnapshot",
                  },
                  {
                    guard: "syncToClue",
                    target: "#roomMachine.phase.clue",
                    actions: "assignSnapshot",
                  },
                  {
                    guard: "syncToReveal",
                    target: "#roomMachine.phase.reveal",
                    actions: "assignSnapshot",
                  },
                  {
                    guard: "syncToFinished",
                    target: "#roomMachine.phase.finished",
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
        spectator: {
          initial: "idle",
          states: {
            idle: {},
            watching: {},
            requesting: {},
            "waiting-host": {},
            approved: {},
            rejected: {},
          },
        },
      },
    },
    {
      actions: {
        // NOTE: Safe Update の hold/release は useRoomMachineController でページ単位で管理するため、
        // フェーズ別制御は no-op にした。部屋にいる間は waiting 含め常に hold される。
        holdInGameAutoApplyAction: () => {
          /* no-op: Safe Update control moved to useRoomMachineController */
        },
        releaseInGameAutoApplyAction: () => {
          /* no-op: Safe Update control moved to useRoomMachineController */
        },
        assignSnapshot: assign(({ context, event }) => {
          if (event.type !== "SYNC") {
            return context;
          }
          const nextRoom = event.room ? sanitizeRoom(event.room) : null;
          const nextPlayers = sanitizePlayers(event.players ?? [], context.players);
          const nextOnline = Array.isArray(event.onlineUids)
            ? [...event.onlineUids]
            : undefined;
          const nextPresenceReady = event.presenceReady ?? context.presenceReady;
          recordRoomMetrics(nextRoom, nextPlayers, nextOnline, nextPresenceReady);
          // NOTE: フェーズ別の hold/release 呼び出しは削除。
          // Safe Update は useRoomMachineController でページ単位で管理される。
          return {
            ...context,
            room: nextRoom,
            players: nextPlayers,
            onlineUids: nextOnline,
            presenceReady: nextPresenceReady,
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
              traceAction("#roomMachine.spectator.recallAccepted", { roomId: context.roomId, uid });
              bumpMetric("recall", "accepted");
            } else if (snapshot.status === "rejected") {
              traceAction("#roomMachine.spectator.recallRejected", { roomId: context.roomId, uid });
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
          // NOTE: Safe Update は useRoomMachineController でページ単位管理
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
          const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
          void deps.startGame(context.roomId, requestId).catch((error) => {
            reportActionError("startGame", error);
          });
        },
        callDealNumbers: ({ context }) => {
          const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
          void deps.dealNumbers(context.roomId, { requestId }).catch((error) => {
            reportActionError("dealNumbers", error);
          });
        },
        callSubmitOrder: ({ context, event }) => {
          if (event.type !== "SUBMIT_ORDER") return;
          const list = sanitizeOrderList(event.list);
          void deps.submitSortedOrder(context.roomId, list).catch((error) => {
            reportActionError("submitSortedOrder", error);
          });
        },
        callFinalizeReveal: ({ context }) => {
          void deps.finalizeReveal(context.roomId).catch((error) => {
            reportActionError("finalizeReveal", error);
          });
        },
        callReset: ({ context, event }) => {
          if (event.type !== "RESET") return;
          const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
          const optionsWithId = { ...(event.options ?? {}), requestId } as ResetRoomOptions & { requestId: string };
          void deps
            .resetRoomWithPrune(context.roomId, event.keepIds, optionsWithId)
            .catch((error) => {
              reportActionError("resetRoomWithPrune", error);
            });
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
          traceAction("#roomMachine.spectator.recallTimeout", { roomId: context.roomId, uid });
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
            spectatorStatus: "watching" as const,
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
          traceAction("#roomMachine.spectator.forceExit", {
            roomId: context.roomId,
            uid,
            reason: event.reason ?? null,
          });
          if (!uid) return;
          void (async () => {
            try {
              await deps.cancelSeatRequest(context.roomId, uid);
            } catch (error) {
              traceError("#roomMachine.spectator.forceExit.cancel", error, {
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
        canStart: ({ context }) => {
          const targets = computeTargetIds(context);
          if (targets.length < 1) {
            return false;
          }
          if (targets.length < 2) {
            traceAction("roomMachine.start.singlePlayer", {
              roomId: context.roomId,
              count: String(targets.length),
              players: targets,
            });
          }
          return true;
        },
        canDeal: ({ context }) => {
          const targets = computeTargetIds(context);
          if (targets.length < 1) {
            return false;
          }
          if (targets.length < 2) {
            traceAction("roomMachine.deal.singlePlayer", {
              roomId: context.roomId,
              count: String(targets.length),
              players: targets,
            });
          }
          return true;
        },
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
        snapshotIsPendingWaitingHost: ({ context, event }) =>
          event.type === "SPECTATOR_REQUEST_SNAPSHOT" &&
          event.snapshot.exists &&
          event.snapshot.status === "pending" &&
          context.spectatorStatus !== "idle",
        snapshotIsPendingWatching: ({ context, event }) =>
          event.type === "SPECTATOR_REQUEST_SNAPSHOT" &&
          event.snapshot.exists &&
          event.snapshot.status === "pending" &&
          context.spectatorStatus === "idle",
        snapshotIsAccepted: ({ event }) =>
          event.type === "SPECTATOR_REQUEST_SNAPSHOT" &&
          event.snapshot.exists &&
          event.snapshot.status === "accepted",
        snapshotIsRejected: ({ event }) =>
          event.type === "SPECTATOR_REQUEST_SNAPSHOT" &&
          event.snapshot.exists &&
          event.snapshot.status === "rejected",
        snapshotClearsToWatching: ({ event }) =>
          event.type === "SPECTATOR_REQUEST_SNAPSHOT" && !event.snapshot.exists,
      },
    }
  );
}

export type RoomMachine = ReturnType<typeof createRoomMachine>;
export type RoomMachineActorRef = ActorRefFrom<RoomMachine>;
export type RoomMachineSnapshot = StateFrom<RoomMachine>;
