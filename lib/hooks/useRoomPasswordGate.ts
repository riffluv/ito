import { notify } from "@/components/ui/notify";
import { verifyPassword } from "@/lib/security/password";
import { logError } from "@/lib/utils/log";
import { getCachedRoomPasswordHash, storeRoomPasswordHash } from "@/lib/utils/roomPassword";
import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";

type RouterLike = { push: (href: string) => void };

type UseRoomPasswordGateParams = {
  roomId: string;
  roomRequiresPassword: boolean;
  roomPasswordHash: string | null;
  roomPasswordSalt: string | null;
  router: RouterLike;
  setPasswordVerified: Dispatch<SetStateAction<boolean>>;
  setPasswordDialogOpen: Dispatch<SetStateAction<boolean>>;
  setPasswordDialogLoading: Dispatch<SetStateAction<boolean>>;
  setPasswordDialogError: Dispatch<SetStateAction<string | null>>;
};

export function useRoomPasswordGate(params: UseRoomPasswordGateParams) {
  const {
    roomId,
    roomRequiresPassword,
    roomPasswordHash,
    roomPasswordSalt,
    router,
    setPasswordVerified,
    setPasswordDialogOpen,
    setPasswordDialogLoading,
    setPasswordDialogError,
  } = params;

  useEffect(() => {
    if (!roomRequiresPassword) {
      setPasswordVerified(true);
      setPasswordDialogOpen(false);
      setPasswordDialogError(null);
      return;
    }
    const cached = getCachedRoomPasswordHash(roomId);
    if (cached && roomPasswordHash && cached === roomPasswordHash) {
      setPasswordVerified(true);
      setPasswordDialogOpen(false);
      setPasswordDialogError(null);
      return;
    }
    setPasswordVerified(false);
    setPasswordDialogOpen(true);
    setPasswordDialogError(null);
  }, [
    roomId,
    roomRequiresPassword,
    roomPasswordHash,
    setPasswordDialogError,
    setPasswordDialogOpen,
    setPasswordVerified,
  ]);

  const handleRoomPasswordSubmit = useCallback(
    async (input: string) => {
      setPasswordDialogLoading(true);
      setPasswordDialogError(null);
      try {
        const ok = await verifyPassword(input.trim(), roomPasswordSalt, roomPasswordHash);
        if (!ok) {
          setPasswordDialogError("パスワードが違います");
          return;
        }
        storeRoomPasswordHash(roomId, roomPasswordHash ?? "");
        setPasswordVerified(true);
        setPasswordDialogOpen(false);
      } catch (error) {
        logError("room-page", "verify-room-password-failed", error);
        setPasswordDialogError("パスワードの検証に失敗しました");
      } finally {
        setPasswordDialogLoading(false);
      }
    },
    [
      roomId,
      roomPasswordHash,
      roomPasswordSalt,
      setPasswordDialogError,
      setPasswordDialogLoading,
      setPasswordDialogOpen,
      setPasswordVerified,
    ]
  );

  const handleRoomPasswordCancel = useCallback(() => {
    notify({ title: "ロビーに戻りました", type: "info" });
    router.push("/");
  }, [router]);

  return { handleRoomPasswordSubmit, handleRoomPasswordCancel };
}
