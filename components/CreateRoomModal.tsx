"use client";

import { CreateRoomFormBody } from "@/components/create-room-modal/CreateRoomFormBody";
import { CreateRoomModalFooter } from "@/components/create-room-modal/CreateRoomModalFooter";
import { CreateRoomModalHeader } from "@/components/create-room-modal/CreateRoomModalHeader";
import { CreateRoomSuccessBody } from "@/components/create-room-modal/CreateRoomSuccessBody";
import { useCreateRoomModalPixiBackdrop } from "@/components/create-room-modal/useCreateRoomModalPixiBackdrop";
import IconButtonDQ from "@/components/ui/IconButtonDQ";
import { MODAL_FRAME_STYLES } from "@/components/ui/modalFrameStyles";
import { notify } from "@/components/ui/notify";
import { useTransition } from "@/components/ui/TransitionProvider";
import { useAuth } from "@/context/AuthContext";
import { firebaseEnabled } from "@/lib/firebase/client";
import { applyDisplayModeToName } from "@/lib/game/displayMode";
import { createPasswordEntry } from "@/lib/security/password";
import {
  apiCheckRoomCreateVersion,
  apiCreateRoom,
  type ApiError,
} from "@/lib/services/roomApiClient";
import type { RoomOptions } from "@/lib/types";
import { logError } from "@/lib/utils/log";
import { storeRoomPasswordHash } from "@/lib/utils/roomPassword";
import { validateDisplayName, validateRoomName } from "@/lib/validation/forms";
import { UI_TOKENS } from "@/theme/layout";
import { Dialog } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ZodError } from "zod";

export function CreateRoomModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (roomId: string) => void;
}) {
  const { user, displayName } = useAuth();
  const router = useRouter();
  const transition = useTransition();
  const [name, setName] = useState("");
  const [displayMode, setDisplayMode] = useState<"full" | "minimal">("full");
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const { modalRef } = useCreateRoomModalPixiBackdrop({ isOpen });

  useEffect(() => {
    if (!enablePassword) {
      setPassword("");
      setPasswordError(null);
    }
  }, [enablePassword]);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDisplayMode("full");
      setCreatedRoomId(null);
      setInviteCopied(false);
      setSubmitting(false);
      setEnablePassword(false);
      setPassword("");
      setPasswordError(null);
    }
  }, [isOpen]);

  const isSuccess = Boolean(createdRoomId);

  const inviteUrl = useMemo(() => {
    if (!createdRoomId) return "";
    if (typeof window === "undefined") {
      return `/r/${createdRoomId}`;
    }
    return `${window.location.origin}/r/${createdRoomId}`;
  }, [createdRoomId]);

  const handleCreate = async () => {
    if (submitting) return;

    if (!firebaseEnabled) {
      notify({ title: "Firebaseの設定が見つかりません", type: "error" });
      return;
    }
    if (!user) {
      notify({
        title: "サインイン処理中です。少し待ってから再試行してください",
        type: "info",
      });
      return;
    }

    let sanitizedRoomName: string;
    try {
      sanitizedRoomName = validateRoomName(name);
    } catch (err) {
      const description =
        err instanceof ZodError ? err.errors[0]?.message : undefined;
      notify({
        title: "部屋名を確認してください",
        description,
        type: "error",
      });
      return;
    }

    let sanitizedDisplayName: string;
    try {
      sanitizedDisplayName = validateDisplayName(displayName || "");
    } catch (err) {
      const description =
        err instanceof ZodError ? err.errors[0]?.message : undefined;
      notify({
        title: "プレイヤー名を設定してください",
        description,
        type: "warning",
      });
      return;
    }

    if (enablePassword) {
      const trimmed = password.trim();
      if (trimmed.length !== 4 || !/^\d{4}$/.test(trimmed)) {
        setPasswordError("4桁の ひみつ ばんごう を入力してください");
        return;
      }
      if (trimmed !== password) {
        setPassword(trimmed);
      }
      setPasswordError(null);
    } else if (passwordError) {
      setPasswordError(null);
    }

    setSubmitting(true);

    try {
      try {
        await apiCheckRoomCreateVersion();
      } catch (error) {
        const code = (error as ApiError | undefined)?.code;
        if (code === "room/create/update-required") {
          notify({
            title: "アップデートが必要です",
            description:
              "このバージョンでは新しい部屋を作成できません。ページを更新して最新バージョンでお試しください。",
            type: "error",
          });
          return;
        }
        logError("rooms", "create-room-version-check-failed", error);
        notify({
          title: "バージョン確認に失敗しました",
          description: "最新のアプリに更新してからもう一度お試しください。",
          type: "error",
        });
        return;
      }

      const options: RoomOptions = {
        allowContinueAfterFail: true,
        resolveMode: "sort-submit",
        displayMode,
        defaultTopicType: "通常版",
      };
      let passwordEntry: PasswordEntry | null = null;
      if (enablePassword) {
        passwordEntry = await createPasswordEntry(password.trim());
      }
      const apiResult = await apiCreateRoom({
        roomName: applyDisplayModeToName(sanitizedRoomName, displayMode),
        displayName: sanitizedDisplayName || "匿名",
        displayMode,
        options,
        passwordHash: passwordEntry?.hash ?? null,
        passwordSalt: passwordEntry?.salt ?? null,
        passwordVersion: passwordEntry?.version ?? null,
      });

      if (enablePassword && passwordEntry?.hash) {
        storeRoomPasswordHash(apiResult.roomId, passwordEntry.hash);
      }

      setCreatedRoomId(apiResult.roomId);
      setInviteCopied(false);
      setPassword("");
      onCreated?.(apiResult.roomId);
    } catch (error) {
      logError("rooms", "create-room", error);
      notify({
        title: "作成に失敗しました",
        description: error instanceof Error ? error.message : undefined,
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyInvite = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = inviteUrl;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setInviteCopied(true);
      notify({ title: "招待URLをコピーしました", type: "success" });
    } catch {
      setInviteCopied(false);
      notify({ title: "コピーできませんでした", type: "error" });
    }
  }, [inviteUrl]);

  const handleEnterRoom = useCallback(async () => {
    if (!createdRoomId) return;
    const roomId = createdRoomId;
    const targetUrl = `/rooms/${roomId}`;
    try {
      await transition.navigateWithTransition(
        targetUrl,
        {
          direction: "fade",
          duration: 1.2,
          showLoading: true,
          loadingSteps: [
            { id: "firebase", message: "せつぞく中です...", duration: 1500 },
            { id: "room", message: "へやを じゅんびしています...", duration: 2000 },
            { id: "player", message: "プレイヤーを とうろくしています...", duration: 1800 },
            { id: "ready", message: "じゅんびが かんりょうしました！", duration: 1000 },
          ],
        },
        async () => {
          scheduleIdleTask(() => {
            try {
              router.prefetch?.(targetUrl);
            } catch {}
          });
        }
      );
    } catch (error) {
      console.error("Room enter transition failed:", error);
      router.push(targetUrl);
    } finally {
      onClose();
    }
  }, [createdRoomId, onClose, router, transition]);

  const handleReset = useCallback(() => {
    setCreatedRoomId(null);
    setInviteCopied(false);
    setName("");
    setDisplayMode("full");
  }, []);

  const canSubmit = name.trim().length > 0 && !submitting;

  return (
    <Dialog.Root
      open={isOpen}
      closeOnInteractOutside={false}
      onOpenChange={(d) => !d.open && onClose()}
    >
      {/* Sophisticated backdrop */}
      <Dialog.Backdrop
        css={{
          background: "overlayStrong",
          backdropFilter: "blur(12px) saturate(1.2)",
        }}
      />

      <Dialog.Positioner>
        <Dialog.Content ref={modalRef} css={MODAL_FRAME_STYLES}>
          {/* Close button - ドラクエ風 */}
          <IconButtonDQ
            aria-label="閉じる"
            onClick={onClose}
            size="sm"
            css={{
              position: "absolute",
              top: "12px",
              right: "12px",
              zIndex: 30,
              borderRadius: 0, // NameDialogと同じ角ばり
              padding: "0",
              cursor: "pointer",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              fontWeight: "bold",
              "&:hover": {
                background: "white",
                color: UI_TOKENS.COLORS.panelBg,
              },
            }}
          >
            ✕
          </IconButtonDQ>

          <CreateRoomModalHeader isSuccess={isSuccess} />

          {/* Form Content - ドラクエ風 */}
          {isSuccess ? (
            <CreateRoomSuccessBody
              inviteUrl={inviteUrl}
              inviteCopied={inviteCopied}
              onCopyInvite={handleCopyInvite}
            />
          ) : (
            <CreateRoomFormBody
              hasUser={!!user}
              name={name}
              setName={setName}
              enablePassword={enablePassword}
              setEnablePassword={setEnablePassword}
              password={password}
              setPassword={setPassword}
              passwordError={passwordError}
              displayMode={displayMode}
              setDisplayMode={setDisplayMode}
            />
          )}

          <CreateRoomModalFooter
            isSuccess={isSuccess}
            canSubmit={canSubmit}
            submitting={submitting}
            onReset={handleReset}
            onClose={onClose}
            onEnterRoom={handleEnterRoom}
            onCreate={handleCreate}
          />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

type PasswordEntry = {
  hash: string;
  salt: string;
  version: number;
};

type RequestIdleCallbackFn = (
  callback: IdleRequestCallback,
  options?: IdleRequestOptions
) => number;

const scheduleIdleTask = (task: () => void) => {
  if (typeof window === "undefined") return;
  const idleCallback =
    (window as Window & typeof globalThis & {
      requestIdleCallback?: RequestIdleCallbackFn;
    }).requestIdleCallback;
  if (typeof idleCallback === "function") {
    idleCallback(() => {
      task();
    });
    return;
  }
  window.setTimeout(task, 0);
};
