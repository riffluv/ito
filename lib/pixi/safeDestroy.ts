import type { Container, Graphics } from "pixi.js";

type DestroyFn = NonNullable<Container["destroy"]>;
type DestroyArgs = Parameters<DestroyFn>;

type Destroyable =
  | { destroy?: DestroyFn; destroyed?: boolean | undefined }
  | Container
  | Graphics;

const isDev = process.env.NODE_ENV !== "production";

/**
 * Defensively destroy Pixi objects so renderer bugs do not crash the app.
 */
export function safeDestroy(
  target: Destroyable | null | undefined,
  context?: string,
  ...args: DestroyArgs
): boolean {
  if (!target) {
    return false;
  }

  const destroyFn =
    typeof target.destroy === "function" ? target.destroy.bind(target) : null;

  if (!destroyFn) {
    return false;
  }

  if (target.destroyed) {
    return true;
  }

  try {
    destroyFn(...args);
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
