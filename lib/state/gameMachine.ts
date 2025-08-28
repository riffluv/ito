import { createMachine, assign } from 'xstate';
import type { RoomDoc } from '@/lib/types';

export interface GameContext {
  room: RoomDoc | null;
  players: Array<{ id: string; name: string; number?: number | null }>;
  onlineCount?: number;
  error?: string;
  lastAction?: string;
}

export type GameEvent =
  | { type: 'LOAD_ROOM'; room: RoomDoc; players: any[]; onlineCount?: number }
  | { type: 'START_GAME' }
  | { type: 'SELECT_TOPIC'; topic: string; topicType: string }
  | { type: 'DEAL_NUMBERS' }
  | { type: 'PLAY_CARD'; playerId: string }
  | { type: 'SUBMIT_SORTED_ORDER'; list: string[] }
  | { type: 'FINALIZE_REVEAL' }
  | { type: 'RESET' }
  | { type: 'ERROR'; error: string };

export const gameMachine = createMachine({
  id: 'game',
  types: {} as {
    context: GameContext;
    events: GameEvent;
  },
  initial: 'loading',
  context: {
    room: null,
    players: [],
    onlineCount: undefined,
    error: undefined,
    lastAction: undefined,
  },
  states: {
    loading: {
      on: {
        LOAD_ROOM: {
          target: 'loaded',
          actions: assign({
            room: ({ event }) => event.room,
            players: ({ event }) => event.players,
            onlineCount: ({ event }) => event.onlineCount,
            error: undefined,
          }),
        },
        ERROR: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },

    loaded: {
      always: [
        { target: 'waiting', guard: ({ context }) => context.room?.status === 'waiting' },
        { target: 'clue', guard: ({ context }) => context.room?.status === 'clue' },
        { target: 'reveal', guard: ({ context }) => context.room?.status === 'reveal' },
        { target: 'finished', guard: ({ context }) => context.room?.status === 'finished' },
      ],
    },

    waiting: {
      entry: assign({
        lastAction: 'entered_waiting',
      }),
      on: {
        START_GAME: {
          target: 'preparing',
          actions: assign({
            lastAction: 'start_game_triggered',
          }),
        },
        LOAD_ROOM: {
          target: 'loaded',
          actions: assign({
            room: ({ event }) => event.room,
            players: ({ event }) => event.players,
            onlineCount: ({ event }) => event.onlineCount,
          }),
        },
      },
    },

    preparing: {
      entry: assign({
        lastAction: 'preparing_game',
      }),
      on: {
        SELECT_TOPIC: {
          target: 'topicSelected',
          actions: assign({
            lastAction: ({ event }) => `topic_selected_${event.topic}`,
          }),
        },
        LOAD_ROOM: {
          target: 'loaded',
          actions: assign({
            room: ({ event }) => event.room,
            players: ({ event }) => event.players,
            onlineCount: ({ event }) => event.onlineCount,
          }),
        },
      },
    },

    topicSelected: {
      entry: assign({
        lastAction: 'topic_selected',
      }),
      on: {
        DEAL_NUMBERS: {
          target: 'clue',
          actions: assign({
            lastAction: 'numbers_dealt',
          }),
        },
        LOAD_ROOM: {
          target: 'loaded',
          actions: assign({
            room: ({ event }) => event.room,
            players: ({ event }) => event.players,
            onlineCount: ({ event }) => event.onlineCount,
          }),
        },
      },
    },

    clue: {
      entry: assign({
        lastAction: 'entered_clue_phase',
      }),
      on: {
        PLAY_CARD: [
          {
            target: 'finished',
            guard: ({ context, event }) => {
              // Check if this card play should finish the game (sequential mode)
              const room = context.room;
              return room?.options?.resolveMode === 'sequential' && shouldFinishSequential(context, event.playerId);
            },
            actions: assign({
              lastAction: ({ event }) => `card_played_finish_${event.playerId}`,
            }),
          },
          {
            target: 'clue',
            actions: assign({
              lastAction: ({ event }) => `card_played_${event.playerId}`,
            }),
          },
        ],
        SUBMIT_SORTED_ORDER: {
          target: 'reveal',
          guard: ({ context }) => context.room?.options?.resolveMode === 'sort-submit',
          actions: assign({
            lastAction: ({ event }) => `order_submitted_${event.list.length}_cards`,
          }),
        },
        LOAD_ROOM: {
          target: 'loaded',
          actions: assign({
            room: ({ event }) => event.room,
            players: ({ event }) => event.players,
            onlineCount: ({ event }) => event.onlineCount,
          }),
        },
      },
    },

    reveal: {
      entry: assign({
        lastAction: 'entered_reveal_animation',
      }),
      on: {
        FINALIZE_REVEAL: {
          target: 'finished',
          actions: assign({
            lastAction: 'reveal_finalized',
          }),
        },
        LOAD_ROOM: {
          target: 'loaded',
          actions: assign({
            room: ({ event }) => event.room,
            players: ({ event }) => event.players,
            onlineCount: ({ event }) => event.onlineCount,
          }),
        },
      },
    },

    finished: {
      entry: assign({
        lastAction: ({ context }) => `game_finished_${context.room?.result?.success ? 'success' : 'failed'}`,
      }),
      on: {
        RESET: {
          target: 'waiting',
          actions: assign({
            lastAction: 'game_reset',
            error: undefined,
          }),
        },
        LOAD_ROOM: {
          target: 'loaded',
          actions: assign({
            room: ({ event }) => event.room,
            players: ({ event }) => event.players,
            onlineCount: ({ event }) => event.onlineCount,
          }),
        },
      },
    },

    error: {
      entry: assign({
        lastAction: ({ context }) => `error_${context.error}`,
      }),
      on: {
        LOAD_ROOM: {
          target: 'loaded',
          actions: assign({
            room: ({ event }) => event.room,
            players: ({ event }) => event.players,
            onlineCount: ({ event }) => event.onlineCount,
            error: undefined,
          }),
        },
        RESET: {
          target: 'waiting',
          actions: assign({
            error: undefined,
            lastAction: 'reset_from_error',
          }),
        },
      },
    },
  },
});

// Helper function to determine if sequential game should finish
function shouldFinishSequential(context: GameContext, playerId: string): boolean {
  const room = context.room;
  if (!room?.order) return false;

  const currentList = room.order.list || [];
  const wouldBeNewLength = currentList.includes(playerId) ? currentList.length : currentList.length + 1;
  
  // Check if this would be the last player or if failure occurred
  const effectiveActive = context.onlineCount || context.players.length;
  const total = room.order.total || effectiveActive;
  
  // Finish if all players have played or if failure occurred
  return wouldBeNewLength >= total || !!room.order.failed;
}

// State machine guards and utilities
export const gameGuards = {
  isWaiting: ({ context }: { context: GameContext }) => context.room?.status === 'waiting',
  isClue: ({ context }: { context: GameContext }) => context.room?.status === 'clue',
  isReveal: ({ context }: { context: GameContext }) => context.room?.status === 'reveal',
  isFinished: ({ context }: { context: GameContext }) => context.room?.status === 'finished',
  isSequentialMode: ({ context }: { context: GameContext }) => context.room?.options?.resolveMode === 'sequential',
  isSortSubmitMode: ({ context }: { context: GameContext }) => context.room?.options?.resolveMode === 'sort-submit',
  hasEnoughPlayers: ({ context }: { context: GameContext }) => {
    const effectiveActive = context.onlineCount || context.players.length;
    return effectiveActive >= 2;
  },
  canEvaluateOrder: ({ context }: { context: GameContext }) => {
    if (context.room?.options?.resolveMode !== 'sort-submit') return false;
    const proposal = context.room?.order?.proposal || [];
    const orderList = context.room?.order?.list || [];
    const placedCount = proposal.length > 0 ? proposal.length : orderList.length;
    const effectiveActive = context.onlineCount || context.players.length;
    return placedCount >= 2 && placedCount === effectiveActive;
  },
};

// Selector functions for UI components
export const gameSelectors = {
  getCurrentStatus: (context: GameContext) => context.room?.status || 'loading',
  getResolveMode: (context: GameContext) => context.room?.options?.resolveMode || 'sequential',
  getEffectivePlayerCount: (context: GameContext) => context.onlineCount || context.players.length,
  getPlacedCardsCount: (context: GameContext) => {
    const proposal = context.room?.order?.proposal || [];
    const orderList = context.room?.order?.list || [];
    return proposal.length > 0 ? proposal.length : orderList.length;
  },
  getGameResult: (context: GameContext) => context.room?.result || null,
  isGameFailed: (context: GameContext) => !!context.room?.order?.failed,
  getFailedAt: (context: GameContext) => context.room?.order?.failedAt || null,
  getLastAction: (context: GameContext) => context.lastAction,
  hasError: (context: GameContext) => !!context.error,
  getError: (context: GameContext) => context.error,
};