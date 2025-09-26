import { SoundManager } from "./SoundManager";

type ManagerSubscriber = (manager: SoundManager | null) => void;

let instance: SoundManager | null = null;
const subscribers = new Set<ManagerSubscriber>();

export const setGlobalSoundManager = (manager: SoundManager | null) => {
  instance = manager;
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
