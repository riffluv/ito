"use client";

import { UI_TOKENS } from "@/theme/layout";

export const MODAL_FRAME_STYLES = {
  background: "transparent",
  border: `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
  borderRadius: "3px",
  boxShadow: "0 1px 0 rgba(255,255,255,.08), 0 14px 28px -12px rgba(0,0,0,.65)",
  maxWidth: "520px",
  width: "90vw",
  padding: 0,
  overflow: "hidden",
  position: "relative" as const,
} as const;
