import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  magnetState: MagnetResult;
  magnetSnapshot: MagnetSnapshot;
  magnetTargetId: string | null;
  magnetConfigRef: React.MutableRefObject<MagnetConfig>;
  enqueueMagnetUpdate: (update: EnqueueUpdateArgs) => void;
  resetMagnet: (options?: ResetOptions) => void;
  scheduleMagnetTarget: (nextId: string | null) => void;
  getProjectedMagnetTarget: () => string | null;
  getProjectedMagnetState: () => MagnetResult;
};

export function useMagnetController(
  magnetConfig: MagnetConfig,
  { prefersReducedMotion }: MagnetControllerOptions
): MagnetController {
  const [magnetState, setMagnetState] = useState<MagnetResult>(() =>
    createInitialMagnetState()
  );
  const magnetStateRef = useRef(magnetState);
  useEffect(() => {
    magnetStateRef.current = magnetState;
  }, [magnetState]);

  const [magnetTargetId, setMagnetTargetId] = useState<string | null>(null);
  const magnetTargetRef = useRef<string | null>(null);

  const pendingMagnetStateRef = useRef<MagnetResult | null>(null);
  const pendingMagnetTargetIdRef = useRef<string | null | undefined>(undefined);

  const magnetFlushFrameRef = useRef<number | null>(null);
  const magnetHighlightTimeoutRef = useRef<number | null>(null);
  const magnetConfigRef = useRef<MagnetConfig>(magnetConfig);

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

  const flushMagnetUpdates = useCallback(() => {
    const nextState = pendingMagnetStateRef.current;
    const nextTarget = pendingMagnetTargetIdRef.current;
    pendingMagnetStateRef.current = null;
    pendingMagnetTargetIdRef.current = undefined;
    if (nextState) {
      magnetStateRef.current = nextState;
      setMagnetState(nextState);
    }
    if (nextTarget !== undefined) {
      magnetTargetRef.current = nextTarget;
      setMagnetTargetId(nextTarget);
    }
  }, []);

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

  const enqueueMagnetUpdate = useCallback(
    (update: EnqueueUpdateArgs) => {
      let didQueue = false;
      if (update.state) {
        pendingMagnetStateRef.current = update.state;
        didQueue = true;
      }
      if (Object.prototype.hasOwnProperty.call(update, "target")) {
        pendingMagnetTargetIdRef.current = update.target ?? null;
        didQueue = true;
      }
      if (!didQueue) return;
      scheduleMagnetFlush({ immediate: update.immediate });
    },
    [scheduleMagnetFlush]
  );

  const getProjectedMagnetTarget = useCallback(() => {
    return pendingMagnetTargetIdRef.current !== undefined
      ? pendingMagnetTargetIdRef.current
      : magnetTargetRef.current;
  }, []);

  const getProjectedMagnetState = useCallback(() => {
    return pendingMagnetStateRef.current ?? magnetStateRef.current;
  }, []);

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

      const delay = prefersReducedMotion ? 36 : 90;
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

  const magnetSnapshot = useMemo<MagnetSnapshot>(
    () => ({ targetId: magnetTargetId, strength: magnetState.strength }),
    [magnetTargetId, magnetState.strength]
  );

  return {
    magnetState,
    magnetSnapshot,
    magnetTargetId,
    magnetConfigRef,
    enqueueMagnetUpdate,
    resetMagnet,
    scheduleMagnetTarget,
    getProjectedMagnetTarget,
    getProjectedMagnetState,
  };
}
