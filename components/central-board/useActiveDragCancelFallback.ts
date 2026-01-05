import { useEffect } from "react";

export type ActiveDragCancelReason =
  | "visibilitychange"
  | "pointercancel"
  | "touchcancel"
  | "blur";

export function useActiveDragCancelFallback(params: {
  activeId: string | null;
  cancel: (reason: ActiveDragCancelReason) => void;
}) {
  useEffect(() => {
    if (!params.activeId || typeof window === "undefined") return undefined;
    const handlePointerCancel = () => params.cancel("pointercancel");
    const handleTouchCancel = () => params.cancel("touchcancel");
    const handleBlur = () => params.cancel("blur");
    const handleVisibility = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        params.cancel("visibilitychange");
      }
    };
    const touchCancelOptions: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("touchcancel", handleTouchCancel, touchCancelOptions);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("touchcancel", handleTouchCancel);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [params.activeId, params.cancel]);
}

