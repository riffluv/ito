import { notify, notifyAsync } from "@/components/ui/notify";
import { transferHost } from "@/lib/firebase/rooms";
import { toastIds } from "@/lib/ui/toastIds";
import { traceAction, traceError } from "@/lib/utils/trace";
import { useCallback, useEffect, useMemo, useState } from "react";

type HostOverride = { targetId: string; previousId: string | null } | null;

type Params = {
  roomId: string | null | undefined;
  hostId: string | null | undefined;
  isHostUser: boolean | undefined;
};

export function useDragonQuestPartyHostTransfer({ roomId, hostId, isHostUser }: Params) {
  const [hostOverride, setHostOverride] = useState<HostOverride>(null);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);

  const displayedHostId = hostOverride?.targetId ?? hostId ?? null;
  const transferInFlight = transferTargetId !== null;
  const effectiveIsHostUser = Boolean(isHostUser && !hostOverride);

  useEffect(() => {
    if (!hostOverride) {
      return () => undefined;
    }
    if (hostId === hostOverride.targetId) {
      setHostOverride(null);
      return () => undefined;
    }
    if (
      hostId !== null &&
      hostId !== undefined &&
      hostId !== hostOverride.previousId &&
      hostId !== hostOverride.targetId
    ) {
      setHostOverride(null);
    }
    if (hostId === null && hostOverride.previousId === null) {
      setHostOverride(null);
    }
    return () => undefined;
  }, [hostId, hostOverride]);

  useEffect(() => {
    if (!transferTargetId) {
      return undefined;
    }
    if (hostId === transferTargetId) {
      setTransferTargetId(null);
      return undefined;
    }
    return undefined;
  }, [hostId, transferTargetId]);

  const handleHostTransfer = useCallback(
    async (targetId: string, targetName: string) => {
      if (!roomId || transferTargetId !== null) return;
      traceAction("ui.host.transfer", { roomId, targetId });
      const previousId = displayedHostId;
      setTransferTargetId(targetId);
      setHostOverride({ targetId, previousId });

      const toastId = toastIds.hostTransfer(roomId, targetId);
      try {
        const result = await notifyAsync(() => transferHost(roomId, targetId), {
          pending: {
            id: toastId,
            title: `${targetName} をホストに設定中…`,
            type: "info",
            duration: 1500,
          },
          success: {
            id: toastId,
            title: `${targetName} がホストになりました`,
            type: "success",
            duration: 2000,
          },
          error: {
            id: toastId,
            title: "委譲に失敗しました",
            type: "error",
            duration: 3000,
          },
        });

        if (result === null) {
          traceError("ui.host.transfer", "result_null", { roomId, targetId });
          setHostOverride((current) =>
            current && current.targetId === targetId ? null : current
          );
          setTransferTargetId((current) => (current === targetId ? null : current));
          notify({
            id: toastId,
            title: "ホスト委譲を元に戻しました",
            description: "ネットワーク状況を確認してもう一度お試しください",
            type: "warning",
            duration: 3200,
          });
        }
      } catch (error) {
        traceError("ui.host.transfer", error, { roomId, targetId });
        setHostOverride((current) =>
          current && current.targetId === targetId ? null : current
        );
        setTransferTargetId((current) => (current === targetId ? null : current));
        notify({
          id: toastIds.hostTransfer(roomId, targetId),
          title: "ホスト委譲に失敗しました",
          description:
            error instanceof Error
              ? error.message
              : "ネットワーク状況を確認してもう一度お試しください",
          type: "error",
          duration: 3200,
        });
      }
    },
    [roomId, transferTargetId, displayedHostId]
  );

  return useMemo(
    () => ({
      displayedHostId,
      transferTargetId,
      transferInFlight,
      effectiveIsHostUser,
      handleHostTransfer,
    }),
    [
      displayedHostId,
      transferTargetId,
      transferInFlight,
      effectiveIsHostUser,
      handleHostTransfer,
    ]
  );
}
