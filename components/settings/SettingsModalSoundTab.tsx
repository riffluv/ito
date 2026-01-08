"use client";

import SoundSettingsPlaceholder from "@/components/settings/SoundSettingsPlaceholder";
import { SoundSettingsPanel } from "@/components/settings/SoundSettingsPanel";
import {
  SOUND_FEATURE_LOCKED,
  SOUND_LOCK_MESSAGE,
} from "@/components/settings/settingsModalModel";

export function SettingsModalSoundTab(props: {
  muted: boolean;
  masterVolume: number;
  soundManagerReady: boolean;
}) {
  const { muted, masterVolume, soundManagerReady } = props;

  return SOUND_FEATURE_LOCKED ? (
    <SoundSettingsPlaceholder
      locked={SOUND_FEATURE_LOCKED}
      message={SOUND_LOCK_MESSAGE}
      masterVolume={masterVolume}
      muted={muted}
      soundManagerReady={soundManagerReady}
    />
  ) : (
    <SoundSettingsPanel />
  );
}

