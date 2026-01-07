"use client";

import { notify } from "@/components/ui/notify";
import { APP_VERSION } from "@/lib/constants/appVersion";
import {
  getRoomServiceErrorCode,
  RoomServiceError,
} from "@/lib/services/roomService";
import { traceAction, traceError } from "@/lib/utils/trace";
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

export type RoomAccessErrorDetail =
  | {
      kind: "version-mismatch";
      mismatchType: "client_outdated" | "room_outdated" | "unknown";
      roomVersion: string | null;
      clientVersion: string | null;
      serverVersion: string | null;
      source: "join" | "ensureMember";
    }
  | {
      kind: "version-check-failed";
      detail: string;
      source: "join" | "ensureMember";
    };

export function useRoomSnapshotAccessHandlers(params: {
  roomId: string;
  roomAccessBlocked: boolean;
  detach: () => void;
  setRoomAccessError: Dispatch<SetStateAction<string | null>>;
  setRoomAccessErrorDetail: Dispatch<SetStateAction<RoomAccessErrorDetail | null>>;
  joinCompletedRef: MutableRefObject<boolean>;
  joinLimitNotifiedRef: MutableRefObject<boolean>;
  accessBlockNotifiedRef: MutableRefObject<boolean>;
}): {
  handleRoomServiceAccessError: (error: unknown, source: "join" | "ensureMember") => boolean;
} {
  const {
    roomId,
    roomAccessBlocked,
    detach,
    setRoomAccessError,
    setRoomAccessErrorDetail,
    joinCompletedRef,
    joinLimitNotifiedRef,
    accessBlockNotifiedRef,
  } = params;

  const applyRoomAccessBlock = useCallback(
    (
      nextError:
        | "client-update-required"
        | "room-version-mismatch"
        | "room-version-check-failed",
      detail: RoomAccessErrorDetail
    ) => {
      if (roomAccessBlocked) return;
      traceAction("room.access.denied", { roomId, code: nextError });
      setRoomAccessError(nextError);
      setRoomAccessErrorDetail(detail);
      joinCompletedRef.current = true;
      joinLimitNotifiedRef.current = true;
      try {
        detach();
      } catch {}

      if (accessBlockNotifiedRef.current) return;
      accessBlockNotifiedRef.current = true;

      if (nextError === "client-update-required" && detail.kind === "version-mismatch") {
        notify({
          title: "アップデートが必要です",
          description:
            `この部屋はバージョン ${detail.roomVersion ?? "不明"} で進行中です。` +
            `現在のバージョン (${detail.clientVersion ?? APP_VERSION}) では参加できません。` +
            "ページを更新して最新バージョンでお試しください。",
          type: "error",
        });
        return;
      }

      if (nextError === "room-version-mismatch" && detail.kind === "version-mismatch") {
        notify({
          title: "この部屋は別バージョンです",
          description:
            `この部屋はバージョン ${detail.roomVersion ?? "不明"} で進行中です。` +
            `現在のバージョン (${detail.clientVersion ?? APP_VERSION}) からは参加・操作できません。` +
            "更新してもこの部屋には入れないため、新しい部屋を作成するか招待を取り直してください。",
          type: "error",
        });
        return;
      }

      if (nextError === "room-version-check-failed" && detail.kind === "version-check-failed") {
        notify({
          title: "バージョン確認に失敗しました",
          description: "ページを更新してから、もう一度入室をお試しください。",
          type: "error",
        });
      }
    },
    [
      accessBlockNotifiedRef,
      detach,
      joinCompletedRef,
      joinLimitNotifiedRef,
      roomAccessBlocked,
      roomId,
      setRoomAccessError,
      setRoomAccessErrorDetail,
    ]
  );

  const handleRoomServiceAccessError = useCallback(
    (error: unknown, source: "join" | "ensureMember"): boolean => {
      const code = getRoomServiceErrorCode(error);
      if (code === "ROOM_VERSION_MISMATCH") {
        const mismatch = error instanceof RoomServiceError ? error : null;
        const mismatchType =
          mismatch?.mismatchType === "client_outdated" ||
          mismatch?.mismatchType === "room_outdated"
            ? mismatch.mismatchType
            : "unknown";
        traceAction("room.access.denied.versionMismatch", {
          roomId,
          source,
          mismatchType,
          roomVersion: mismatch?.roomVersion ?? null,
          clientVersion: mismatch?.clientVersion ?? APP_VERSION,
          serverVersion: mismatch?.serverVersion ?? null,
        });
        applyRoomAccessBlock(
          mismatchType === "client_outdated"
            ? "client-update-required"
            : "room-version-mismatch",
          {
            kind: "version-mismatch",
            mismatchType,
            roomVersion: mismatch?.roomVersion ?? null,
            clientVersion: mismatch?.clientVersion ?? APP_VERSION,
            serverVersion: mismatch?.serverVersion ?? null,
            source,
          }
        );
        return true;
      }
      if (code === "ROOM_VERSION_CHECK_FAILED") {
        const detail =
          error instanceof RoomServiceError
            ? error.checkFailedDetail ?? "unknown"
            : "unknown";
        traceError("room.access.denied.versionCheckFailed", error, {
          roomId,
          source,
          detail,
        });
        applyRoomAccessBlock("room-version-check-failed", {
          kind: "version-check-failed",
          detail,
          source,
        });
        return true;
      }
      return false;
    },
    [applyRoomAccessBlock, roomId]
  );

  return { handleRoomServiceAccessError };
}
