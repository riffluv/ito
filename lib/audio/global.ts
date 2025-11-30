import { SoundManager } from "./SoundManager";

type ManagerSubscriber = (manager: SoundManager | null) => void;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

let instance: SoundManager | null = null;
const subscribers = new Set<ManagerSubscriber>();

let readyDeferred: Deferred<SoundManager | null> = createDeferred();

export const resetSoundReady = () => {
  readyDeferred = createDeferred();
};

export const markSoundReady = (manager: SoundManager | null) => {
  readyDeferred.resolve(manager);
};

export const getSoundReadyPromise = () => readyDeferred.promise;

export const waitForSoundReady = async (options?: {
  timeoutMs?: number;
}): Promise<{ manager: SoundManager | null; ready: boolean; timedOut: boolean }> => {
  const timeoutMs = Math.max(0, options?.timeoutMs ?? 2400);
  const timeoutToken = Symbol("sound-ready-timeout");
  const timeoutPromise =
    timeoutMs > 0
      ? new Promise<typeof timeoutToken>((resolve) => {
          setTimeout(() => resolve(timeoutToken), timeoutMs);
        })
      : null;

  const result = timeoutPromise
    ? await Promise.race([readyDeferred.promise, timeoutPromise])
    : await readyDeferred.promise;

  if (result === timeoutToken) {
    return { manager: instance, ready: false, timedOut: true };
  }
  return { manager: result as SoundManager | null, ready: !!result, timedOut: false };
};

export const setGlobalSoundManager = (manager: SoundManager | null) => {
  instance = manager;
  if (manager === null) {
    resetSoundReady();
  }
  subscribers.forEach((listener) => {
    try {
      listener(instance);
    } catch (error) {
      console.error("[SoundGlobal] subscriber error", error);
    }
  });
};

export const getGlobalSoundManager = () => instance;

export const subscribeGlobalSoundManager = (listener: ManagerSubscriber) => {
  subscribers.add(listener);
  listener(instance);
  return () => {
    subscribers.delete(listener);
  };
};
