import type { SoundId } from "@/lib/audio/types";

/**
 * Round start sound policy
 *
 * - Host confirms start with a short "order_confirm" click.
 * - A longer "round_start" sound is reserved for future global playback.
 * - Toggle `ROUND_START_GLOBAL_SOUND_ENABLED` when we want to broadcast the
 *   global start cue to all clients via Showtime.
 */
export const ROUND_START_GLOBAL_SOUND_ENABLED = false;

export const getRoundStartSoundId = (
  status?: string | null
): SoundId => (status === "waiting" ? "order_confirm" : "round_start");
