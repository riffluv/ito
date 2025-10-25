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
  type ActorRefFrom,
  type StateFrom,
} from "xstate";

type PlayerWithId = (PlayerDoc & { id: string }) | { id: string; ready?: boolean };

export type RoomMachineContext = {
  roomId: string;
  room: (RoomDoc & { id?: string }) | null;
  players: PlayerWithId[];
  onlineUids?: string[];
  presenceReady: boolean;
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
    };

type RoomMachineInternalEvent =
  | RoomMachineClientEvent
  | {
      type: "SYNC";
      room: (RoomDoc & { id?: string }) | null;
      players: PlayerWithId[];
      onlineUids?: string[] | null;
      presenceReady?: boolean;
    };

type RoomMachineDeps = {
  startGame: typeof GameService.startGame;
  dealNumbers: typeof GameService.dealNumbers;
  submitSortedOrder: typeof GameService.submitSortedOrder;
  finalizeReveal: typeof GameService.finalizeReveal;
  resetRoomWithPrune: typeof GameService.resetRoomWithPrune;
};

const defaultDeps: RoomMachineDeps = {
  startGame: GameService.startGame,
  dealNumbers: GameService.dealNumbers,
  submitSortedOrder: GameService.submitSortedOrder,
  finalizeReveal: GameService.finalizeReveal,
  resetRoomWithPrune: GameService.resetRoomWithPrune,
};

type RoomMachineInput = {
  roomId: string;
  room?: (RoomDoc & { id?: string }) | null;
  players?: PlayerWithId[];
  onlineUids?: string[] | null;
  presenceReady?: boolean;
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
        room: sanitizedRoom,
        players: sanitizedPlayers,
        onlineUids: sanitizedOnline,
        presenceReady: input.presenceReady ?? false,
      }),
      types: {} as {
        context: RoomMachineContext;
        events: RoomMachineInternalEvent;
      },
      initial: resolveStatus(sanitizedRoom),
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
