// Central place to tune reveal animation pacing (all values in ms).
export const REVEAL_FIRST_DELAY = 220; // short anticipation right after "3,2,1"
export const REVEAL_STEP_DELAY = 780; // per-card cadence: face dwell + micro gap
export const REVEAL_LINGER = 520; // extra beat before finishing reveal
export const RESULT_VISIBLE_MS = 4200; // result screen stay duration
export const FLIP_DURATION_MS = 320; // actual 3D flip length

// Sequential mode (kept aligned with sort-submit reveal timings).
export const SEQ_FIRST_CLUE_MS = 260;
export const SEQ_FLIP_INTERVAL_MS = 780;

// Shared easing curves.
export const CARD_FLIP_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";
export const HOVER_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
export const BOUNCE_EASING = "cubic-bezier(0.68, -0.55, 0.265, 1.55)";
