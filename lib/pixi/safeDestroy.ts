import type { Container, Graphics } from "pixi.js";

type Destroyable =
  | { destroy?: (...args: any[]) => void; destroyed?: boolean | undefined }
  | Container
  | Graphics;

const isDev = process.env.NODE_ENV !== "production";

/**
 * Defensively destroy Pixi objects so renderer bugs do not crash the app.
 */
export function safeDestroy(
  target: Destroyable | null | undefined,
  context?: string,
  ...args: any[]
): boolean {
  if (!target) {
    return false;
  }

  const destroyFn =
    typeof target.destroy === "function" ? target.destroy : null;

  if (!destroyFn) {
    return false;
  }

  if ((target as Destroyable).destroyed) {
    return true;
  }

  try {
    destroyFn.apply(target, args);
    return true;
  } catch (error) {
    if (isDev) {
      console.warn(
        `[pixi:safeDestroy] ${context ?? "destroyable"} destroy failed`,
        error
      );
    }
    return false;
  }
}
