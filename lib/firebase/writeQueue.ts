import { bumpMetric, setMetric } from "@/lib/utils/metrics";

const queues = new Map<string, QueueState>();
const DEFAULT_MIN_INTERVAL = 120;

const ENABLE_QUEUE_DEBUG =
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_DEBUG_FIRESTORE_QUEUE === "1" ||
    process.env.NEXT_PUBLIC_DEBUG_FIRESTORE_QUEUE === "true");

type Task<T> = () => Promise<T>;

interface QueueState {
  running: boolean;
  lastRun: number;
  tasks: Array<QueuedTask<unknown>>;
  minInterval: number;
}

interface QueuedTask<T> {
  execute: Task<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function getQueue(scope: string, minInterval: number): QueueState {
  const existing = queues.get(scope);
  if (existing) {
    if (minInterval > existing.minInterval) {
      existing.minInterval = minInterval;
    }
    return existing;
  }
  const state: QueueState = {
    running: false,
    lastRun: 0,
    tasks: [],
    minInterval,
  };
  queues.set(scope, state);
  return state;
}

const logQueueDebug = (...args: Parameters<typeof console.debug>) => {
  if (!ENABLE_QUEUE_DEBUG || typeof console === "undefined") return;
  // eslint-disable-next-line no-console
  console.debug(...args);
};

async function runNext(scope: string) {
  const state = queues.get(scope);
  if (!state) return;
  if (state.running) return;
  const nextTask = state.tasks.shift();
  if (!nextTask) return;
  state.running = true;
  const elapsed = Date.now() - state.lastRun;
  const wait = Math.max(state.minInterval - elapsed, 0);
  setMetric("firestoreQueue", `${scope}:pending`, state.tasks.length);
  setMetric("firestoreQueue", `${scope}:waitMs`, wait);

  logQueueDebug(
    `[FirestoreQueue] ${scope}: starting task (wait ${wait}ms, remaining ${state.tasks.length})`
  );

  const start = async () => {
    const startTime = ENABLE_QUEUE_DEBUG && typeof performance !== "undefined" ? performance.now() : 0;
    try {
      const result = await nextTask.execute();
      state.lastRun = Date.now();
      nextTask.resolve(result);
      bumpMetric("firestoreQueue", `${scope}:success`);
    } catch (error) {
      nextTask.reject(error);
      bumpMetric("firestoreQueue", `${scope}:errors`);
    } finally {
      state.running = false;
      if (ENABLE_QUEUE_DEBUG && typeof performance !== "undefined") {
        const duration = startTime ? performance.now() - startTime : 0;
        logQueueDebug(
          `[FirestoreQueue] ${scope}: task completed in ${duration ? duration.toFixed(2) : "?"}ms`
        );
      }
      setMetric("firestoreQueue", `${scope}:pending`, state.tasks.length);
      if (state.tasks.length === 0) {
        queues.delete(scope);
      } else {
        void runNext(scope);
      }
    }
  };

  if (wait > 0) {
    setTimeout(() => void start(), wait);
  } else {
    void start();
  }
}

export function enqueueFirestoreWrite<T>(
  scope: string,
  task: Task<T>,
  options?: { minIntervalMs?: number }
): Promise<T> {
  const state = getQueue(scope, options?.minIntervalMs ?? DEFAULT_MIN_INTERVAL);

  return new Promise<T>((resolve, reject) => {
    const wrappedTask: QueuedTask<unknown> = {
      execute: task as Task<unknown>,
      resolve: (value: unknown | PromiseLike<unknown>) => {
        resolve(value as T);
      },
      reject,
    };
    state.tasks.push(wrappedTask);
    logQueueDebug(
      `[FirestoreQueue] ${scope}: enqueued (size ${state.tasks.length}${state.running ? ", running" : ""})`
    );
    setMetric("firestoreQueue", `${scope}:pending`, state.tasks.length);
    bumpMetric("firestoreQueue", `${scope}:enqueued`);
    void runNext(scope);
  });
}
