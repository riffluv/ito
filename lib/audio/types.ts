export type SoundCategory = "ui" | "notify" | "drag" | "ambient" | "system" | "card" | "fanfare";

export type SoundId =
  | "ui_click"
  | "card_flip"
  | "card_place"
  | "card_deal"
  | "topic_shuffle"
  | "reset_game"
  | "clear_success1"
  | "clear_success2"
  | "clear_failure"
  | "drag_pickup"
  | "drop_success"
  | "drop_invalid"
  | "notify_success"
  | "notify_error"
  | "result_victory"
  | "result_failure"
  | "notify_warning"
  | "round_start"
  | "order_confirm"
  | "clue_decide"
  | "ledger_open"
  | "ledger_close"
  | "settings_open"
  | "settings_close"
  | "bgm1";

export type Range = {
  min: number;
  max: number;
};

export type SoundVariant = {
  /**
   * Path inside the public folder. If extension is omitted we will try a set of known extensions.
   * Example: "sfx/ui/ui_click" maps to public/sfx/ui/ui_click.{webm|ogg|mp3|wav}.
   */
  src: string;
  /** Relative playback gain multiplier applied on top of category/master gains. */
  gainMultiplier?: number;
  /** Higher weight increases the chance of this variant being selected. */
  weight?: number;
};

export type SoundPreloadOptions = {
  link?: boolean;
  decode?: boolean;
};

export type SoundDefinition = {
  id: SoundId;
  category: SoundCategory;
  preload?: SoundPreloadOptions;
  /**
   * When true the previous instance is stopped before playing a new one. Defaults to false, allowing overlap.
   */
  stopPrevious?: boolean;
  /** Optional textual note for designers. */
  note?: string;
  variants: SoundVariant[];
  playbackRateRange?: Range;
  gainDbRange?: Range;
  startOffsetMsRange?: Range;
  loop?: boolean;
  /** Delay before playback in seconds. */
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
};

export type PlaybackOverrides = {
  volumeMultiplier?: number;
  playbackRate?: number;
  skipUnlock?: boolean;
};

export type SoundSuccessMode = "normal" | "epic";

export type SoundSettings = {
  masterVolume: number; // 0..1 linear
  muted: boolean;
  categoryVolume: Record<SoundCategory, number>;
  successMode: SoundSuccessMode;
};

export type SoundEvent =
  | { type: "settings"; settings: SoundSettings }
  | { type: "missing"; soundId: SoundId; attemptedUrl: string };
export const SOUND_CATEGORIES: SoundCategory[] = [
  "ui",
  "notify",
  "drag",
  "ambient",
  "system",
  "card",
  "fanfare",
];

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  masterVolume: 0.85,
  muted: false,
  successMode: "epic",
  categoryVolume: {
    ui: 1,
    notify: 1,
    drag: 1,
    ambient: 0.2,
    system: 1,
    card: 1,
    fanfare: 0.5,
  },
};
