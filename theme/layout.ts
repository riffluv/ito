// Central layout dimension constants (2025 CSS best practices)
// Single source of truth for structural sizing to avoid magic numbers scattered in components.
// All exported as const so they can be type-narrowed and reused in recipes if needed.

export const LAYOUT = {
  HEADER_MIN_HEIGHT: 56, // was fixed; now row = auto but used as design reference
  SIDEBAR_WIDTH: 280,
  RIGHT_PANEL_WIDTH: 340,
  HAND_MIN_HEIGHT: 140,
  HAND_TARGET_HEIGHT: 160,
  BOARD_MIN_HEIGHT: 220, // central board drop zone min height
} as const;

// Helpers to convert numeric px to Chakra friendly template strings when needed
export const px = (v: number) => `${v}px`;

// Grid template helpers
export const ROOM_GRID_COLUMNS_MD = `${LAYOUT.SIDEBAR_WIDTH}px 1fr ${LAYOUT.RIGHT_PANEL_WIDTH}px`;
export const ROOM_GRID_ROWS_BASE = `auto 1fr auto`;
export const ROOM_GRID_ROWS_MD = `auto 1fr minmax(${LAYOUT.HAND_MIN_HEIGHT}px, ${LAYOUT.HAND_TARGET_HEIGHT}px)`;

export type LayoutConstants = typeof LAYOUT;
