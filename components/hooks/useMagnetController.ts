import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type MutableRefObject,
} from "react";
import type { MagnetConfig, MagnetResult } from "@/lib/ui/dragMagnet";

export const createInitialMagnetState = (): MagnetResult => ({
  dx: 0,
  dy: 0,
  strength: 0,
  distance: Number.POSITIVE_INFINITY,
  shouldSnap: false,
});

type MagnetControllerOptions = {
  prefersReducedMotion: boolean;
};

export type MagnetSnapshot = {
  targetId: string | null;
  strength: number;
  shouldSnap: boolean;
};

type EnqueueUpdateArgs = {
  state?: MagnetResult;
  target?: string | null;
  immediate?: boolean;
};

type ResetOptions = {
  immediate?: boolean;
};

export type MagnetController = {
  magnetConfigRef: MutableRefObject<MagnetConfig>;
  enqueueMagnetUpdate: (update: EnqueueUpdateArgs) => void;
  resetMagnet: (options?: ResetOptions) => void;
  scheduleMagnetTarget: (nextId: string | null) => void;
  getProjectedMagnetTarget: () => string | null;
  getProjectedMagnetState: () => MagnetResult;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => MagnetSnapshot;
};

export function useMagnetController(
  magnetConfig: MagnetConfig,
  { prefersReducedMotion }: MagnetControllerOptions
): MagnetController {
  const magnetStateRef = useRef<MagnetResult>(createInitialMagnetState());
  const magnetTargetRef = useRef<string | null>(null);
  const pendingMagnetStateRef = useRef<MagnetResult | null>(null);
  const pendingMagnetTargetRef = useRef<string | null | undefined>(undefined);
  const magnetFlushFrameRef = useRef<number | null>(null);
  const magnetHighlightTimeoutRef = useRef<number | null>(null);
  const magnetConfigRef = useRef<MagnetConfig>(magnetConfig);
  const listenersRef = useRef<Set<() => void>>(new Set());
  const magnetSnapshotRef = useRef<MagnetSnapshot>({
    targetId: null,
    strength: 0,
    shouldSnap: false,
  });

  useEffect(() => {
    magnetConfigRef.current = magnetConfig;
  }, [magnetConfig]);

  useEffect(() => {
    return () => {
      if (magnetFlushFrameRef.current !== null) {
        cancelAnimationFrame(magnetFlushFrameRef.current);
        magnetFlushFrameRef.current = null;
      }
      if (magnetHighlightTimeoutRef.current !== null) {
        clearTimeout(magnetHighlightTimeoutRef.current);
        magnetHighlightTimeoutRef.current = null;
      }
    };
  }, []);

  const notifySubscribers = useCallback(() => {
    listenersRef.current.forEach((listener) => listener());
  }, []);

  const flushMagnetUpdates = useCallback(() => {
    const nextState = pendingMagnetStateRef.current;
    const nextTarget = pendingMagnetTargetRef.current;
    pendingMagnetStateRef.current = null;
    pendingMagnetTargetRef.current = undefined;
    let shouldNotify = false;
    if (nextState) {
      magnetStateRef.current = nextState;
      shouldNotify = true;
    }
    if (nextTarget !== undefined) {
      magnetTargetRef.current = nextTarget;
      shouldNotify = true;
    }
    if (shouldNotify) {
      notifySubscribers();
    }
  }, [notifySubscribers]);

  const scheduleMagnetFlush = useCallback(
    (options?: { immediate?: boolean }) => {
      const immediate = options?.immediate ?? false;
      if (immediate || typeof window === "undefined") {
        if (
          typeof window !== "undefined" &&
          magnetFlushFrameRef.current !== null
        ) {
          window.cancelAnimationFrame(magnetFlushFrameRef.current);
        }
        magnetFlushFrameRef.current = null;
        flushMagnetUpdates();
        return;
      }
      if (magnetFlushFrameRef.current !== null) return;
      magnetFlushFrameRef.current = window.requestAnimationFrame(() => {
        magnetFlushFrameRef.current = null;
        flushMagnetUpdates();
      });
    },
    [flushMagnetUpdates]
  );

  const getProjectedMagnetTarget = useCallback(() => {
    return pendingMagnetTargetRef.current !== undefined
      ? pendingMagnetTargetRef.current
      : magnetTargetRef.current;
  }, []);

  const getProjectedMagnetState = useCallback(() => {
    return pendingMagnetStateRef.current ?? magnetStateRef.current;
  }, []);

  const enqueueMagnetUpdate = useCallback(
    (update: EnqueueUpdateArgs) => {
      let didQueue = false;
      if (update.state) {
        const prev = getProjectedMagnetState();
        let next = update.state;
        // リッチ吸着の“間”を感じさせるため、strengthの立ち上がりを緩和する
        if (next.strength > prev.strength) {
          const maxRise = prefersReducedMotion ? 0.12 : 0.18;
          const cappedStrength = Math.min(next.strength, prev.strength + maxRise);
          if (cappedStrength !== next.strength) {
            const ratio = next.strength > 0 ? cappedStrength / next.strength : 1;
            next = {
              ...next,
              strength: cappedStrength,
              dx: next.dx * ratio,
              dy: next.dy * ratio,
            };
          }
        }
        pendingMagnetStateRef.current = next;
        didQueue = true;
      }
      if (Object.prototype.hasOwnProperty.call(update, "target")) {
        pendingMagnetTargetRef.current = update.target ?? null;
        didQueue = true;
      }
      if (!didQueue) return;
      scheduleMagnetFlush({ immediate: update.immediate });
    },
    [getProjectedMagnetState, prefersReducedMotion, scheduleMagnetFlush]
  );

  const resetMagnet = useCallback(
    (options?: ResetOptions) => {
      const immediate = options?.immediate ?? false;
      const projectedState = getProjectedMagnetState();
      const projectedTarget = getProjectedMagnetTarget();
      const needsStateReset =
        projectedState.dx !== 0 ||
        projectedState.dy !== 0 ||
        projectedState.strength !== 0 ||
        projectedState.shouldSnap;
      const needsTargetReset = projectedTarget !== null;

      if (!needsStateReset && !needsTargetReset) {
        return;
      }

      if (
        typeof window !== "undefined" &&
        magnetHighlightTimeoutRef.current !== null
      ) {
        window.clearTimeout(magnetHighlightTimeoutRef.current);
        magnetHighlightTimeoutRef.current = null;
      }

      enqueueMagnetUpdate({
        state: needsStateReset ? createInitialMagnetState() : undefined,
        target: needsTargetReset ? null : undefined,
        immediate,
      });
    },
    [enqueueMagnetUpdate, getProjectedMagnetState, getProjectedMagnetTarget]
  );

  const scheduleMagnetTarget = useCallback(
    (nextId: string | null) => {
      const projected = getProjectedMagnetTarget();
      if (projected === nextId) return;

      if (
        typeof window !== "undefined" &&
        magnetHighlightTimeoutRef.current !== null
      ) {
        window.clearTimeout(magnetHighlightTimeoutRef.current);
        magnetHighlightTimeoutRef.current = null;
      }

      if (typeof window === "undefined") {
        enqueueMagnetUpdate({ target: nextId, immediate: true });
        return;
      }

      // 早めにハイライトを出し、全スロットで同じ「入り口」を確保
      const delay = prefersReducedMotion ? 24 : 50;
      if (delay <= 0) {
        enqueueMagnetUpdate({ target: nextId });
        return;
      }

      magnetHighlightTimeoutRef.current = window.setTimeout(() => {
        magnetHighlightTimeoutRef.current = null;
        enqueueMagnetUpdate({ target: nextId });
      }, delay);
    },
    [enqueueMagnetUpdate, getProjectedMagnetTarget, prefersReducedMotion]
  );

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback((): MagnetSnapshot => {
    const state = magnetStateRef.current;
    const targetId = magnetTargetRef.current;
    const current = magnetSnapshotRef.current;
    if (
      current.targetId !== targetId ||
      current.strength !== state.strength ||
      current.shouldSnap !== state.shouldSnap
    ) {
      magnetSnapshotRef.current = {
        targetId,
        strength: state.strength,
        shouldSnap: state.shouldSnap,
      };
    }
    return magnetSnapshotRef.current;
  }, []);

  return {
    magnetConfigRef,
    enqueueMagnetUpdate,
    resetMagnet,
    scheduleMagnetTarget,
    getProjectedMagnetTarget,
    getProjectedMagnetState,
    subscribe,
    getSnapshot,
  };
}

export function useMagnetSnapshot(controller: MagnetController): MagnetSnapshot {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );
}
