import type { RectLike } from "@/lib/ui/dragMagnet";

type ActiveWithRect = {
  rect: {
    current: {
      translated?: unknown;
      initial?: unknown;
    };
  };
};

export const snapshotRect = (rect: RectLike): RectLike => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
});

const translateRect = (
  rect: RectLike,
  delta: { x: number; y: number }
): RectLike => ({
  left: rect.left + delta.x,
  top: rect.top + delta.y,
  width: rect.width,
  height: rect.height,
});

export const getActiveRectWithDelta = (
  active: ActiveWithRect,
  delta?: { x: number; y: number }
): RectLike | null => {
  const translated = active.rect.current.translated;
  if (translated) {
    return translated as RectLike;
  }
  const initial = active.rect.current.initial;
  if (!initial) return null;
  if (delta && (delta.x !== 0 || delta.y !== 0)) {
    return translateRect(initial as RectLike, delta);
  }
  return initial as RectLike;
};

