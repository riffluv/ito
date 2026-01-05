import { useEffect } from "react";

type DropDebugWindow = typeof window & {
  dumpBoardState?: () => unknown;
};

export function useBoardDebugDump(params: { enabled: boolean; dump: () => unknown }) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const debugWindow = window as DropDebugWindow;
    if (!params.enabled) {
      if (debugWindow.dumpBoardState) {
        delete debugWindow.dumpBoardState;
      }
      return undefined;
    }

    debugWindow.dumpBoardState = params.dump;
    return () => {
      if (debugWindow.dumpBoardState === params.dump) {
        delete debugWindow.dumpBoardState;
      }
    };
  }, [params.enabled, params.dump]);
}

