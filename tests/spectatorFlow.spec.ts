import { expect, test } from "@playwright/test";
import { performance as nodePerformance } from "perf_hooks";
import { clearSpectatorFlags } from "../lib/spectator/sessionFlags";
import {
  logSpectatorForceExitCleanup,
  logSpectatorForceExitDetected,
  logSpectatorForceExitRecovered,
  logSpectatorRequestEnqueue,
} from "../lib/spectator/telemetry";

type TraceRecord = {
  name: string;
  detail?: Record<string, unknown>;
};

const TRACE_BUFFER_KEY = "__ITO_TRACE_BUFFER__";

const createSessionStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
    get length(): number {
      return store.size;
    },
  };
};

const getTraceBuffer = (): TraceRecord[] =>
  ((globalThis as typeof globalThis & { [TRACE_BUFFER_KEY]?: TraceRecord[] })[TRACE_BUFFER_KEY] ?? []).map(
    (record) => ({ ...record })
  );

test.beforeEach(() => {
  (globalThis as typeof globalThis & { window?: any }).window = {
    sessionStorage: createSessionStorage(),
  };
  (globalThis as typeof globalThis & { performance?: Performance }).performance = nodePerformance as unknown as Performance;
  (globalThis as typeof globalThis & { [TRACE_BUFFER_KEY]?: TraceRecord[] })[TRACE_BUFFER_KEY] = [];
});

test("シナリオ1: 通常参加後に pending フラグがクリアされる", () => {
  const roomId = "room-alpha";
  const uid = "guest-1";
  const rejoinKey = `pendingRejoin:${roomId}`;

  window.sessionStorage.setItem(rejoinKey, uid);

  const result = clearSpectatorFlags({
    roomId,
    uid,
    rejoinSessionKey: rejoinKey,
    autoJoinSuppressKey: null,
  });

  expect(result.pendingCleared).toBe(true);
  expect(result.autoJoinCleared).toBe(false);
  expect(window.sessionStorage.getItem(rejoinKey)).toBeNull();

  const traces = getTraceBuffer();
  const pendingTrace = traces.find((entry) => entry.name === "spectator.pending.clear");
  expect(pendingTrace).toBeDefined();
  expect(pendingTrace?.detail).toMatchObject({
    roomId,
    uid,
    autoJoinSuppressCleared: false,
  });
});

test("シナリオ2: 観戦キュー後に recall 解放で pending/autoJoin が同時に消える", () => {
  const roomId = "room-beta";
  const uid = "guest-2";
  const rejoinKey = `pendingRejoin:${roomId}`;
  const autoSuppressKey = `autoJoinSuppress:${roomId}:${uid}`;

  logSpectatorRequestEnqueue({
    roomId,
    uid,
    source: "manual",
    canRequestNow: false,
    roomStatus: "waiting",
    recallOpen: false,
  });

  window.sessionStorage.setItem(rejoinKey, uid);
  window.sessionStorage.setItem(autoSuppressKey, "1");

  const result = clearSpectatorFlags({
    roomId,
    uid,
    rejoinSessionKey: rejoinKey,
    autoJoinSuppressKey: autoSuppressKey,
  });

  expect(result).toEqual({ pendingCleared: true, autoJoinCleared: true });
  expect(window.sessionStorage.getItem(rejoinKey)).toBeNull();
  expect(window.sessionStorage.getItem(autoSuppressKey)).toBeNull();

  const traces = getTraceBuffer();
  const requestTrace = traces.find((entry) => entry.name === "spectator.request.enqueue");
  expect(requestTrace).toBeDefined();
  expect(requestTrace?.detail).toMatchObject({
    roomId,
    uid,
    canRequestNow: false,
    recallOpen: false,
  });

  const pendingTrace = traces.filter((entry) => entry.name === "spectator.pending.clear").at(-1);
  expect(pendingTrace).toBeDefined();
  expect(pendingTrace?.detail).toMatchObject({
    roomId,
    uid,
    autoJoinSuppressCleared: true,
  });
});

test("シナリオ3: 強制退席検出から復帰までのトレースとクリーンアップ", () => {
  const roomId = "room-gamma";
  const uid = "guest-3";
  const rejoinKey = `pendingRejoin:${roomId}`;
  const autoSuppressKey = `autoJoinSuppress:${roomId}:${uid}`;

  logSpectatorForceExitDetected({
    roomId,
    uid,
    reason: "mid-game",
    canAccess: false,
    recallOpen: false,
    status: "clue",
  });
  logSpectatorForceExitCleanup({
    roomId,
    uid,
    reason: "mid-game",
  });
  logSpectatorForceExitRecovered({
    roomId,
    uid,
    status: "waiting",
    canAccess: true,
  });

  const traces = getTraceBuffer();
  expect(traces.map((entry) => entry.name)).toEqual([
    "spectator.forceExit.detected",
    "spectator.forceExit.cleanup",
    "spectator.forceExit.recovered",
  ]);

  window.sessionStorage.setItem(rejoinKey, uid);
  window.sessionStorage.setItem(autoSuppressKey, "1");

  const clearResult = clearSpectatorFlags({
    roomId,
    uid,
    rejoinSessionKey: rejoinKey,
    autoJoinSuppressKey: autoSuppressKey,
  });

  expect(clearResult.pendingCleared).toBe(true);
  expect(clearResult.autoJoinCleared).toBe(true);
  expect(window.sessionStorage.getItem(rejoinKey)).toBeNull();
  expect(window.sessionStorage.getItem(autoSuppressKey)).toBeNull();

  const pendingTrace = getTraceBuffer().filter((entry) => entry.name === "spectator.pending.clear").at(-1);
  expect(pendingTrace).toBeDefined();
  expect(pendingTrace?.detail).toMatchObject({
    roomId,
    uid,
    autoJoinSuppressCleared: true,
  });
});
