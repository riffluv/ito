import { gameMachine, gameSelectors } from "@/lib/state/gameMachine";
import type { RoomDoc } from "@/lib/types";
import { useMachine } from "@xstate/react";

export function useGameMachine() {
  const [state, send] = useMachine(gameMachine, {
    // Add debugging in development
    // devTools: process.env.NODE_ENV === 'development',
  });

  const context = state.context;
  const currentState = state.value as string;

  // Actions
  const actions = {
    loadRoom: (room: RoomDoc, players: any[], onlineCount?: number) => {
      send({ type: "LOAD_ROOM", room, players, onlineCount });
    },
    startGame: () => {
      send({ type: "START_GAME" });
    },
    selectTopic: (topic: string, topicType: string) => {
      send({ type: "SELECT_TOPIC", topic, topicType });
    },
    dealNumbers: () => {
      send({ type: "DEAL_NUMBERS" });
    },
    // playCard removed - only sort-submit mode supported
    submitSortedOrder: (list: string[]) => {
      send({ type: "SUBMIT_SORTED_ORDER", list });
    },
    finalizeReveal: () => {
      send({ type: "FINALIZE_REVEAL" });
    },
    reset: () => {
      send({ type: "RESET" });
    },
    error: (error: string) => {
      send({ type: "ERROR", error });
    },
  };

  // Selectors using the context
  const selectors = {
    getCurrentStatus: () => gameSelectors.getCurrentStatus(context),
    getResolveMode: () => gameSelectors.getResolveMode(context),
    getEffectivePlayerCount: () =>
      gameSelectors.getEffectivePlayerCount(context),
    getPlacedCardsCount: () => gameSelectors.getPlacedCardsCount(context),
    getGameResult: () => gameSelectors.getGameResult(context),
    isGameFailed: () => gameSelectors.isGameFailed(context),
    getFailedAt: () => gameSelectors.getFailedAt(context),
    getLastAction: () => gameSelectors.getLastAction(context),
    hasError: () => gameSelectors.hasError(context),
    getError: () => gameSelectors.getError(context),
  };

  // State checks
  const is = {
    loading: currentState === "loading",
    waiting: currentState === "waiting",
    preparing: currentState === "preparing",
    topicSelected: currentState === "topicSelected",
    clue: currentState === "clue",
    reveal: currentState === "reveal",
    finished: currentState === "finished",
    error: currentState === "error",
  };

  // Computed properties
  const computed = {
    canStartGame: () => {
      return is.waiting && selectors.getEffectivePlayerCount() >= 2;
    },
    canEvaluateOrder: () => {
      if (selectors.getResolveMode() !== "sort-submit") return false;
      const placedCount = selectors.getPlacedCardsCount();
      const effectiveActive = selectors.getEffectivePlayerCount();
      return placedCount >= 2 && placedCount === effectiveActive;
    },
    isSequentialMode: () => selectors.getResolveMode() === "sequential",
    isSortSubmitMode: () => selectors.getResolveMode() === "sort-submit",
  };

  // Debug information (only in development)
  const debug =
    process.env.NODE_ENV === "development"
      ? {
          currentState,
          context,
          transitions: state.can,
          // nextEvents: state.nextEvents, // XState v5では廃止
        }
      : {};

  return {
    // State information
    currentState,
    is,
    context,

    // Actions
    actions,

    // Selectors
    selectors,

    // Computed properties
    computed,

    // Debug (development only)
    debug,

    // Raw state machine (for advanced usage)
    state,
    send,
  };
}

// Helper hook for just getting state information without actions
export function useGameState() {
  const { is, selectors, computed, context } = useGameMachine();

  return {
    is,
    selectors,
    computed,
    context,
  };
}

// Hook for debugging game state (development only)
export function useGameDebug() {
  const { debug, context, currentState } = useGameMachine();

  if (process.env.NODE_ENV !== "development") {
    return { debugInfo: null };
  }

  return {
    debugInfo: {
      ...debug,
      // Add additional debug information
      stateHistory: [], // Could be implemented with state machine history
      validTransitions: [], // debug.nextEvents || [],
      contextSnapshot: JSON.stringify(context, null, 2),
    },
  };
}
