import { notify } from "@/components/ui/notify";
import { KEYBOARD_KEYS } from "@/components/ui/hints/constants";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { updateClue1 } from "@/lib/firebase/players";
import type { PlayerDoc } from "@/lib/types";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { toastIds } from "@/lib/ui/toastIds";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type RefObject,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

export type ClueFeedback = { message: string; tone: "info" | "success" };

type UseClueInputOptions = {
  roomId: string;
  roomStatus?: string;
  player: (PlayerDoc & { id: string }) | null | undefined;
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement>;
  onFeedback?: (payload: ClueFeedback | null) => void;
};

export function useClueInput({
  roomId,
  roomStatus,
  player,
  inputRef,
  onFeedback,
}: UseClueInputOptions) {
  const [text, setText] = useState<string>(player?.clue1 || "");
  const deferredText = useDeferredValue(text);
  const trimmedText = useMemo(() => text.trim(), [text]);
  const deferredTrimmedText = useMemo(
    () => deferredText.trim(),
    [deferredText]
  );
  const clueEditable = roomStatus === "waiting" || roomStatus === "clue";
  const ready = !!player?.ready;
  const hasText = trimmedText.length > 0;
  const displayHasText = deferredTrimmedText.length > 0;
  const canDecide =
    clueEditable &&
    !!player?.id &&
    typeof player?.number === "number" &&
    hasText;
  const playClueDecide = useSoundEffect("clue_decide");

  const [shouldShowSpaceHint, setShouldShowSpaceHint] = useState(false);

  useEffect(() => {
    setText(player?.clue1 || "");
  }, [player?.clue1]);

  useEffect(() => {
    if (roomStatus === "clue") {
      setShouldShowSpaceHint(true);
    } else {
      setShouldShowSpaceHint(false);
    }
  }, [roomStatus]);

  useEffect(() => {
    if (!ready) return;
    const el = inputRef.current;
    if (!el) return;
    if (typeof document === "undefined") return;
    if (document.activeElement === el) {
      el.blur();
    }
  }, [ready, inputRef]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (!clueEditable) return;
      if (event.key === KEYBOARD_KEYS.SPACE) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [clueEditable, inputRef]);

  const handleDecide = useCallback(async () => {
    if (!canDecide || !player?.id) return;
    try {
      playClueDecide();
      await updateClue1(roomId, player.id, trimmedText);
      onFeedback?.({
        message: "連想ワードを保存しました",
        tone: "success",
      });
    } catch (error: any) {
      if (isFirebaseQuotaExceeded(error)) {
        handleFirebaseQuotaError("連想ワード記録");
        notify({
          id: toastIds.firebaseLimit(roomId, "clue-save"),
          title: "接続制限のため記録不可",
          description:
            "現在連想ワードを記録できません。24時間後に再度お試しください。",
          type: "error",
        });
      } else {
        notify({
          id: toastIds.clueSaveError(roomId),
          title: "記録に失敗しました",
          description: error?.message,
          type: "error",
        });
      }
    }
  }, [canDecide, player?.id, playClueDecide, roomId, trimmedText, onFeedback]);

  const handleClear = useCallback(async () => {
    if (!clueEditable || !player?.id) return;
    try {
      await updateClue1(roomId, player.id, "");
      setText("");
      onFeedback?.({
        message: "連想ワードをクリアしました",
        tone: "info",
      });
    } catch (error: any) {
      notify({
        id: toastIds.clueClearError(roomId),
        title: "クリアに失敗しました",
        description: error?.message,
        type: "error",
      });
    }
  }, [clueEditable, player?.id, roomId, onFeedback]);

  const handleInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === KEYBOARD_KEYS.ENTER && canDecide) {
        event.preventDefault();
        void handleDecide();
      }
    },
    [canDecide, handleDecide]
  );

  return {
    text,
    setText,
    deferredText,
    trimmedText,
    deferredTrimmedText,
    clueEditable,
    canDecide,
    hasText,
    displayHasText,
    ready,
    shouldShowSpaceHint,
    setShouldShowSpaceHint,
    handleDecide,
    handleClear,
    handleInputKeyDown,
  };
}
