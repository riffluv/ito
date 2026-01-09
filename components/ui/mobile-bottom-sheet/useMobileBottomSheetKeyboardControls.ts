import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { ContentType, SheetState } from "@/components/ui/mobile-bottom-sheet/types";

type Params = {
  sheetRef: RefObject<HTMLDivElement>;
  firstButtonRef: RefObject<HTMLButtonElement>;
  sheetState: SheetState;
  setSheetState: Dispatch<SetStateAction<SheetState>>;
  contentType: ContentType;
  setContentType: Dispatch<SetStateAction<ContentType>>;
};

export function useMobileBottomSheetKeyboardControls({
  sheetRef,
  firstButtonRef,
  sheetState,
  setSheetState,
  contentType,
  setContentType,
}: Params) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!sheetRef.current) return;

      if (event.key === "Escape" && sheetState !== "collapsed") {
        event.preventDefault();
        setSheetState("collapsed");
      }

      if (event.key === "Enter" && event.shiftKey && sheetState === "collapsed") {
        event.preventDefault();
        setSheetState("partial");
        setTimeout(() => firstButtonRef.current?.focus(), 100);
      }

      if (sheetState !== "collapsed") {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          if (contentType === "participants") setContentType("chat");
          else if (contentType === "sidebar") setContentType("participants");
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          if (contentType === "chat") setContentType("participants");
          else if (contentType === "participants") setContentType("sidebar");
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sheetState, contentType, setSheetState, setContentType, sheetRef, firstButtonRef]);
}

