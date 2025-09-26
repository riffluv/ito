import { PlaybackOverrides, SoundId } from "./types";
import { getGlobalSoundManager } from "./global";

export const playSound = (soundId: SoundId, overrides?: PlaybackOverrides) => {
  const manager = getGlobalSoundManager();
  if (!manager) return;
  void manager.play(soundId, overrides);
};
