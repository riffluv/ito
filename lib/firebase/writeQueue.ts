const queues = new Map<string, QueueState>();
const DEFAULT_MIN_INTERVAL = 120;

type Task<T> = () => Promise<T>;

interface QueueState {
  running: boolean;
  lastRun: number;
  tasks: Array<QueuedTask<any>>;
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

async function runNext(scope: string) {
  const state = queues.get(scope);
  if (!state) return;
  if (state.running) return;
  const nextTask = state.tasks.shift();
  if (!nextTask) return;
  state.running = true;
  const elapsed = Date.now() - state.lastRun;
  const wait = Math.max(state.minInterval - elapsed, 0);

  const start = async () => {
    try {
      const result = await nextTask.execute();
      state.lastRun = Date.now();
      nextTask.resolve(result);
    } catch (error) {
      nextTask.reject(error);
    } finally {
      state.running = false;
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
    state.tasks.push({ execute: task, resolve, reject });
    void runNext(scope);
  });
}
