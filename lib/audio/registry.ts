import { SoundDefinition, SoundId } from "./types";

export const SFX_BASE_PATH = "/sfx";

export const AUDIO_EXTENSIONS = ["webm", "ogg", "mp3", "wav"] as const;

const createDefinition = (definition: SoundDefinition) => definition;

export const SOUND_LIBRARY: SoundDefinition[] = [
  createDefinition({
    id: "ui_click",
    category: "ui",
    variants: [{ src: "ui/ui_click" }],
    playbackRateRange: { min: 0.96, max: 1.04 },
    gainDbRange: { min: -1.5, max: 1.5 },
    startOffsetMsRange: { min: 0, max: 12 },
    note: "Primary button interactions",
  }),
  createDefinition({
    id: "card_flip",
    category: "card",
    variants: [{ src: "card/card_flip" }],
    playbackRateRange: { min: 0.92, max: 1.03 },
    gainDbRange: { min: -1, max: 1 },
    startOffsetMsRange: { min: 0, max: 20 },
    note: "Card reveal or flip",
  }),
  createDefinition({
    id: "card_place",
    category: "card",
    variants: [{ src: "card/card_place" }],
    playbackRateRange: { min: 0.95, max: 1.05 },
    gainDbRange: { min: -1.5, max: 0.5 },
    note: "Place card into slot",
  }),
  createDefinition({
    id: "card_deal",
    category: "card",
    variants: [{ src: "card/card_deal" }],
    playbackRateRange: { min: 0.95, max: 1.05 },
    gainDbRange: { min: -3, max: -0.5 },
    note: "Deal cards to players",
  }),
  createDefinition({
    id: "drag_pickup",
    category: "drag",
    variants: [{ src: "dnd/drag_pickup" }],
    playbackRateRange: { min: 0.94, max: 1.02 },
    gainDbRange: { min: -1, max: 1 },
    note: "User starts dragging a card",
  }),
  createDefinition({
    id: "drop_success",
    category: "drag",
    variants: [{ src: "dnd/drop_success" }],
    playbackRateRange: { min: 0.95, max: 1.05 },
    gainDbRange: { min: -0.5, max: 1.5 },
    note: "Valid drop interaction",
  }),
  createDefinition({
    id: "drop_invalid",
    category: "drag",
    variants: [{ src: "dnd/drop_invalid" }],
    playbackRateRange: { min: 0.95, max: 1.05 },
    gainDbRange: { min: -3, max: -1 },
    note: "Invalid drop feedback",
    stopPrevious: true,
  }),
  createDefinition({
    id: "notify_success",
    category: "notify",
    variants: [{ src: "notify/notify_success" }],
    playbackRateRange: { min: 0.97, max: 1.02 },
    gainDbRange: { min: -1.5, max: 1 },
    note: "Toast success",
  }),
  createDefinition({
    id: "notify_error",
    category: "notify",
    variants: [{ src: "notify/notify_error" }],
    playbackRateRange: { min: 0.9, max: 1.02 },
    gainDbRange: { min: -1, max: 2 },
    note: "Toast failure",
    stopPrevious: true,
  }),
  createDefinition({
    id: "result_victory",
    category: "result",
    variants: [{ src: "result/result_victory" }],
    playbackRateRange: { min: 0.98, max: 1.02 },
    gainDbRange: { min: -0.5, max: 1.5 },
    minDelaySeconds: 0.05,
    note: "Short win jingle",
  }),
  createDefinition({
    id: "result_failure",
    category: "result",
    variants: [{ src: "result/result_failure" }],
    playbackRateRange: { min: 0.95, max: 1.02 },
    gainDbRange: { min: -0.5, max: 0.5 },
    minDelaySeconds: 0.05,
    note: "Short fail sting",
  }),
  createDefinition({
    id: "notify_warning",
    category: "notify",
    variants: [{ src: "notify/notify_warning" }],
    playbackRateRange: { min: 0.96, max: 1.04 },
    gainDbRange: { min: -1.5, max: 1 },
    note: "Toast warning",
  }),
  createDefinition({
    id: "round_start",
    category: "system",
    variants: [{ src: "system/round_start" }],
    playbackRateRange: { min: 0.99, max: 1.01 },
    gainDbRange: { min: -0.5, max: 1.5 },
    note: "Round intro fanfare",
    stopPrevious: true,
  }),
  createDefinition({
    id: "order_confirm",
    category: "system",
    variants: [{ src: "system/order_confirm" }],
    playbackRateRange: { min: 0.97, max: 1.03 },
    gainDbRange: { min: -1, max: 1 },
    note: "Confirm ordering",
  }),
];

export const SOUND_INDEX: Record<SoundId, SoundDefinition> = SOUND_LIBRARY.reduce(
  (acc, definition) => {
    acc[definition.id] = definition;
    return acc;
  },
  {} as Record<SoundId, SoundDefinition>
);
