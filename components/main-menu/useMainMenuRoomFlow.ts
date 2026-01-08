import type { LobbyRoom } from "@/components/main-menu/types";
import type { useTransition } from "@/components/ui/TransitionProvider";
import { notify } from "@/components/ui/notify";
import { verifyPassword } from "@/lib/security/password";
import { scheduleIdleTask } from "@/lib/utils/idleScheduler";
import { logDebug, logError } from "@/lib/utils/log";
import {
  getCachedRoomPasswordHash,
  storeRoomPasswordHash,
} from "@/lib/utils/roomPassword";
import { useDisclosure } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";

type UseMainMenuRoomFlowParams = {
  displayName: string;
  setDisplayName: (name: string) => void;
  transition: ReturnType<typeof useTransition>;
  router: {
    push: (href: string) => void;
    prefetch: (href: string) => void;
  };
  roomMap: Map<string, LobbyRoom>;
};

export function useMainMenuRoomFlow(params: UseMainMenuRoomFlowParams) {
  const { displayName, setDisplayName, transition, router, roomMap } = params;

  const nameDialog = useDisclosure({ defaultOpen: false });
  const createDialog = useDisclosure();
  const [tempName, setTempName] = useState(displayName || "");
  const [nameDialogMode, setNameDialogMode] = useState<"create" | "edit">(
    "create"
  );

  const pendingJoinRef = useRef<LobbyRoom | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    room: LobbyRoom;
  } | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const goToRoom = useCallback(
    async (room: LobbyRoom) => {
      if (!room) return;
      if (!displayName || !String(displayName).trim()) {
        pendingJoinRef.current = room;
        setTempName("");
        setNameDialogMode("create");
        nameDialog.onOpen();
        return;
      }

      pendingJoinRef.current = null;

      try {
        await transition.navigateWithTransition(
          `/rooms/${room.id}`,
          {
            direction: "fade",
            duration: 1.0,
            showLoading: true,
            loadingSteps: [
              { id: "connect", message: "せつぞく中です...", duration: 550 },
              {
                id: "prepare",
                message: "じゅんびしています...",
                duration: 750,
              },
              {
                id: "ready",
                message: "かんりょう...",
                duration: 700,
              },
            ],
          },
          async () => {
            try {
              scheduleIdleTask(() => {
                try {
                  router.prefetch(`/rooms/${room.id}`);
                } catch (idleError) {
                  logDebug("main-menu", "prefetch-room-skipped", idleError);
                }
              }, { timeoutMs: 2000 });
            } catch (idleScheduleError) {
              logDebug(
                "main-menu",
                "prefetch-room-idle-missing",
                idleScheduleError
              );
            }
          }
        );
      } catch (error) {
        logError("main-menu", "join-transition-failed", error);
        router.push(`/rooms/${room.id}`);
      }
    },
    [displayName, nameDialog, router, transition]
  );

  useEffect(() => {
    if (!displayName || !displayName.trim()) return;
    const pendingRoom = pendingJoinRef.current;
    if (pendingRoom) {
      pendingJoinRef.current = null;
      void goToRoom(pendingRoom);
    }
  }, [displayName, goToRoom]);

  const handleJoinRoom = useCallback(
    (roomId: string) => {
      const room = roomMap.get(roomId) ?? null;
      if (!room) return;
      if (room.status !== "waiting") {
        notify({
          title: "ただいま進行中です",
          description: "ゲームが進行中のため新しい参加を受付できません。",
          type: "warning",
        });
        return;
      }
      if (room.requiresPassword) {
        const cached = getCachedRoomPasswordHash(room.id);
        if (cached && room.passwordHash && cached === room.passwordHash) {
          void goToRoom(room);
          return;
        }
        setPasswordPrompt({ room });
        setPasswordError(null);
        return;
      }
      void goToRoom(room);
    },
    [goToRoom, roomMap]
  );

  const handlePasswordSubmit = useCallback(
    async (input: string) => {
      if (!passwordPrompt?.room) return;
      setPasswordSubmitting(true);
      setPasswordError(null);
      try {
        const ok = await verifyPassword(
          input.trim(),
          passwordPrompt.room.passwordSalt ?? null,
          passwordPrompt.room.passwordHash ?? null
        );
        if (!ok) {
          setPasswordError("パスワードが違います");
          return;
        }
        storeRoomPasswordHash(
          passwordPrompt.room.id,
          passwordPrompt.room.passwordHash ?? ""
        );
        const targetRoom = passwordPrompt.room;
        setPasswordPrompt(null);
        await goToRoom(targetRoom);
      } catch (error) {
        logError("main-menu", "verify-password", error);
        setPasswordError("パスワードの検証に失敗しました");
      } finally {
        setPasswordSubmitting(false);
      }
    },
    [goToRoom, passwordPrompt]
  );

  const handlePasswordCancel = useCallback(() => {
    if (passwordSubmitting) return;
    setPasswordPrompt(null);
    setPasswordError(null);
  }, [passwordSubmitting]);

  const openCreateFlow = useCallback(() => {
    pendingJoinRef.current = null;
    if (!displayName) {
      setTempName("");
      setNameDialogMode("create");
      nameDialog.onOpen();
    } else {
      createDialog.onOpen();
    }
  }, [createDialog, displayName, nameDialog]);

  const openNameChange = useCallback(() => {
    setTempName(displayName || "");
    setNameDialogMode("edit");
    nameDialog.onOpen();
  }, [displayName, nameDialog]);

  const handleNameDialogCancel = useCallback(() => {
    pendingJoinRef.current = null;
    nameDialog.onClose();
  }, [nameDialog]);

  const handleNameDialogSubmit = useCallback(
    async (val: string) => {
      if (!val?.trim()) return;
      const trimmed = val.trim();
      setDisplayName(trimmed);
      nameDialog.onClose();

      if (pendingJoinRef.current) {
        return;
      }

      // 名前設定後のアクション判定
      if (nameDialogMode === "create") {
        // 通常のルーム作成フロー
        createDialog.onOpen();
      }
    },
    [createDialog, nameDialog, nameDialogMode, setDisplayName]
  );

  return {
    nameDialog,
    createDialog,
    tempName,
    nameDialogMode,
    passwordPrompt,
    passwordSubmitting,
    passwordError,
    handleJoinRoom,
    handlePasswordSubmit,
    handlePasswordCancel,
    openCreateFlow,
    openNameChange,
    handleNameDialogCancel,
    handleNameDialogSubmit,
  };
}

