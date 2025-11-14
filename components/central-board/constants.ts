import type { CSSProperties } from "react";

import type { MagnetResult } from "@/lib/ui/dragMagnet";
import { UI_TOKENS } from "@/theme/layout";

export const RETURN_DROP_ZONE_ID = "waiting-return-zone";

export const GHOST_CARD_STYLE: CSSProperties = {
  filter: UI_TOKENS.FILTERS.dropShadowStrong,
  opacity: 0.98,
  pointerEvents: "none",
  willChange: "transform",
};

export const createInitialMagnetState = (): MagnetResult => ({
  dx: 0,
  dy: 0,
  strength: 0,
  distance: Number.POSITIVE_INFINITY,
  shouldSnap: false,
});

export const MAGNET_IDLE_MARGIN_PX = 48;
