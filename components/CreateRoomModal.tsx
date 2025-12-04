"use client";
import { notify } from "@/components/ui/notify";
import { useAuth } from "@/context/AuthContext";
import { useTransition } from "@/components/ui/TransitionProvider";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import type { PlayerDoc, RoomDoc, RoomOptions } from "@/lib/types";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { createInitialRoomStats } from "@/lib/game/roomStats";
import { applyDisplayModeToName } from "@/lib/game/displayMode";
import { AVATAR_LIST } from "@/lib/utils";
import { createPasswordEntry } from "@/lib/security/password";
import { storeRoomPasswordHash } from "@/lib/utils/roomPassword";
import { Box, Dialog, Field, HStack, Input, Switch, Text, VStack } from "@chakra-ui/react";
import IconButtonDQ from "@/components/ui/IconButtonDQ";
import { GamePasswordInput } from "@/components/ui/GamePasswordInput";
import { doc, serverTimestamp, setDoc, Timestamp, DocumentReference, getDoc } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { UI_TOKENS } from "@/theme/layout";
import { logError } from "@/lib/utils/log";
import { validateDisplayName, validateRoomName } from "@/lib/validation/forms";
import { generateRoomId } from "@/lib/utils/roomId";
import { usePixiHudLayer } from "@/components/ui/pixi/PixiHudStage";
import { usePixiLayerLayout } from "@/components/ui/pixi/usePixiLayerLayout";
import PIXI from "@/lib/pixi/instance";
import { drawSettingsModalBackground } from "@/lib/pixi/settingsModalBackground";
import { MODAL_FRAME_STYLES } from "@/components/ui/modalFrameStyles";
import { ZodError } from "zod";

// 共通モーダルスタイル定数（部屋作成 → 完了モーダルのサイズ統一）
// 「人の手」デザイン：角丸3px、影の多層、非対称パディング
// 非対称パディング（上下で微差）
const MODAL_HEADER_PADDING = "22px 24px 19px"; // 上22 左右24 下19
const MODAL_BODY_PADDING = "24px 26px"; // 縦24 横26
const MODAL_FOOTER_PADDING = "18px 24px 22px"; // 上18 左右24 下22

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

  // Pixi HUD レイヤー（モーダル背景用）
  const modalRef = useRef<HTMLDivElement | null>(null);
  const pixiContainer = usePixiHudLayer("create-room-modal", {
    zIndex: 105,
  });
  const pixiGraphicsRef = useRef<PIXI.Graphics | null>(null);

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
      let resolvedAppVersion = APP_VERSION;
      try {
        const res = await fetch("/api/rooms/version-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientVersion: APP_VERSION }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          appVersion?: string;
          error?: string;
          roomVersion?: string;
          clientVersion?: string;
        };

        if (!res.ok) {
          if (body?.error === "room/create/update-required") {
            notify({
              title: "アップデートが必要です",
              description: "このバージョンでは新しい部屋を作成できません。ページを更新して最新バージョンでお試しください。",
              type: "error",
            });
            return;
          }
          throw new Error(body?.error || "version-check-failed");
        }

        if (typeof body?.appVersion === "string" && body.appVersion.trim().length > 0) {
          resolvedAppVersion = body.appVersion.trim();
        }
      } catch (error) {
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
      const expires = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const baseRoomData: RoomCreatePayload = {
        name: applyDisplayModeToName(sanitizedRoomName, displayMode),
        hostId: user.uid,
        hostName: sanitizedDisplayName || "匿名",
        creatorId: user.uid,
        creatorName: sanitizedDisplayName || "匿名",
        appVersion: resolvedAppVersion,
        options,
        status: "waiting",
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        closedAt: null,
        expiresAt: Timestamp.fromDate(expires),
        topic: null,
        topicOptions: null,
        topicBox: null,
        result: null,
        stats: createInitialRoomStats(),
        requiresPassword: enablePassword,
        passwordHash: passwordEntry?.hash ?? null,
        passwordSalt: passwordEntry?.salt ?? null,
        passwordVersion: passwordEntry?.version ?? null,
      };

      const createRoomDocument = async (
        payload: RoomCreatePayload
      ): Promise<DocumentReference> => {
        const MAX_ATTEMPTS = 8;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
          const candidateId = generateRoomId();
          const candidateRef = doc(db!, "rooms", candidateId);
          const existing = await getDoc(candidateRef);
          if (existing.exists()) continue;
          await setDoc(candidateRef, payload);
          return candidateRef;
        }
        throw new Error("ルームIDを割り当てできませんでした。時間をおいて再度お試しください。");
      };

      let roomRef: DocumentReference | null = null;
      try {
        roomRef = await createRoomDocument(baseRoomData);
      } catch (error) {
        if (error instanceof FirebaseError && error.code === "permission-denied") {
          console.warn("[rooms] create-room without creator fields (fallback)", error);
          const fallbackPayload: RoomCreatePayload = { ...baseRoomData };
          delete fallbackPayload.creatorId;
          delete fallbackPayload.creatorName;
          roomRef = await createRoomDocument(fallbackPayload);
        } else {
          throw error;
        }
      }
      if (!roomRef) throw new Error("failed to create room");

      if (enablePassword && passwordEntry?.hash) {
        storeRoomPasswordHash(roomRef.id, passwordEntry.hash);
      }

      const randomIndex = Math.floor(Math.random() * AVATAR_LIST.length);
      const pdoc: PlayerDoc = {
        name: sanitizedDisplayName,
        avatar: AVATAR_LIST[randomIndex],
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0,
        uid: user.uid,
        lastSeen: serverTimestamp(),
      };
      await setDoc(doc(db!, "rooms", roomRef.id, "players", user.uid), pdoc);

      setCreatedRoomId(roomRef.id);
      setInviteCopied(false);
      setPassword("");
      onCreated?.(roomRef.id);
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

  // カード表示モード選択ボタンの共通スタイル
  const getDisplayModeButtonStyle = (isSelected: boolean) => ({
    flex: 1,
    height: "52px",
    borderRadius: 0,
    fontWeight: "bold" as const,
    fontSize: "0.95rem",
    fontFamily: "monospace",
    border: isSelected ? "3px solid white" : "2px solid rgba(255,255,255,0.5)",
    background: isSelected ? "white" : "transparent",
    color: isSelected ? "black" : "white",
    cursor: "pointer" as const,
    textShadow: isSelected ? "none" : "1px 1px 0px #000",
    transition: "180ms cubic-bezier(.2,1,.3,1)",
    boxShadow: isSelected ? "2px 3px 0 rgba(0,0,0,.6)" : "none",
    transform: isSelected ? "translate(.5px,-.5px)" : "none",
  });

  const handleDisplayModeHover = (
    e: React.MouseEvent<HTMLButtonElement>,
    isSelected: boolean,
    isEnter: boolean
  ) => {
    if (!isSelected) {
      if (isEnter) {
        e.currentTarget.style.background = "rgba(255,255,255,0.1)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.8)";
      } else {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
      }
    }
  };

  // Pixi背景の描画とDOM同期
  useEffect(() => {
    if (!isOpen || !pixiContainer) {
      // モーダルが閉じられたらPixiリソースを破棄
      if (pixiGraphicsRef.current) {
        if (pixiGraphicsRef.current.parent) {
          pixiGraphicsRef.current.parent.removeChild(pixiGraphicsRef.current);
        }
        pixiGraphicsRef.current.destroy({ children: true });
        pixiGraphicsRef.current = null;
      }
      return undefined;
    }

    // Graphicsオブジェクトを作成
    const graphics = new PIXI.Graphics();
    graphics.zIndex = -10; // 最背面に配置
    pixiContainer.addChild(graphics);
    pixiGraphicsRef.current = graphics;

    // クリーンアップ
    return () => {
      if (pixiGraphicsRef.current) {
        if (pixiGraphicsRef.current.parent) {
          pixiGraphicsRef.current.parent.removeChild(pixiGraphicsRef.current);
        }
        pixiGraphicsRef.current.destroy({ children: true });
        pixiGraphicsRef.current = null;
      }
    };
  }, [isOpen, pixiContainer]);

  // DOM要素とPixiコンテナの位置・サイズ同期
  usePixiLayerLayout(modalRef, pixiContainer, {
    disabled: !isOpen || !pixiContainer,
    onUpdate: (layout) => {
      const graphics = pixiGraphicsRef.current;
      if (!graphics || layout.width <= 0 || layout.height <= 0) {
        return;
      }

      graphics.clear();
      graphics.position.set(layout.x, layout.y);
      drawSettingsModalBackground(PIXI, graphics, {
        width: layout.width,
        height: layout.height,
        dpr: layout.dpr,
      });
    },
  });

  return (
    <Dialog.Root open={isOpen} closeOnInteractOutside={false} onOpenChange={(d) => !d.open && onClose()}>
      {/* Sophisticated backdrop */}
      <Dialog.Backdrop
        css={{
          background: "overlayStrong",
          backdropFilter: "blur(12px) saturate(1.2)",
        }}
      />

      <Dialog.Positioner>
        <Dialog.Content
          ref={modalRef}
          css={MODAL_FRAME_STYLES}
        >
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

          {/* Header - ドラクエ風 */}
          <Box
            p={MODAL_HEADER_PADDING}
            position="relative"
            zIndex={20}
            css={{
              borderBottom: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            }}
          >
            <VStack gap={2} align="center">
              <Dialog.Title
                css={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "white",
                  margin: 0,
                  textAlign: "center",
                  // NameDialogと同じ通常フォント（monospace削除）
                }}
              >
                {isSuccess ? "へやが できました！" : "へやを つくる"}
              </Dialog.Title>
              <Text
                fontSize="sm"
                color="white"
                fontWeight="normal"
                textAlign="center"
                fontFamily="monospace"
                textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
              >
                {isSuccess ? "なかまを さそって いざ ぼうけんへ" : "あたらしい ぼうけんの はじまり"}
              </Text>
            </VStack>
          </Box>

          {/* Form Content - ドラクエ風 */}
          {isSuccess ? (
            <Box p={MODAL_BODY_PADDING} position="relative" zIndex={20}>
              <VStack gap={4} align="stretch">
                <Text
                  fontSize="sm"
                  color="rgba(255,255,255,0.85)"
                  fontFamily="monospace"
                  textAlign="center"
                  textShadow="0 1px 2px rgba(0,0,0,0.6)"
                >
                  このリンクを おくって なかまを よぼう！
                </Text>

                <Box
                  p={3}
                  bg="rgba(8,9,15,0.6)"
                  border="2px solid rgba(255,255,255,0.3)"
                  borderRadius={0}
                >
                  <Text
                    fontSize="sm"
                    color="rgba(255,255,255,0.95)"
                    fontFamily="monospace"
                    wordBreak="break-all"
                    lineHeight="1.6"
                    textAlign="center"
                  >
                    {inviteUrl}
                  </Text>
                </Box>

                <button
                  type="button"
                  onClick={handleCopyInvite}
                  style={{
                    width: "100%",
                    height: "48px",
                    borderRadius: "3px", // 角丸追加
                    border: `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
                    background: inviteCopied ? "white" : "transparent",
                    color: inviteCopied ? "black" : "white",
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    fontSize: "17px", // 奇数サイズ
                    letterSpacing: "0.02em", // 字間追加
                    padding: "0 17px", // 奇数パディング
                    cursor: "pointer",
                    textShadow: inviteCopied ? "none" : "0 2px 4px rgba(0,0,0,0.8)",
                    transition: "all 180ms cubic-bezier(.2,1,.3,1)", // 手癖カーブ
                    boxShadow: "2px 3px 0 rgba(0,0,0,0.72)", // 微妙にずらす
                    transform: "translate(.5px,-.5px)", // 初期位置微調整
                    outline: "none",
                  }}
                  onMouseEnter={(event) => {
                    if (!inviteCopied) {
                      event.currentTarget.style.background = "white";
                      event.currentTarget.style.color = "black";
                      event.currentTarget.style.transform = "translate(0,-1px)"; // 浮き上がり
                      event.currentTarget.style.boxShadow = "3px 4px 0 rgba(0,0,0,0.72)";
                    }
                  }}
                  onMouseLeave={(event) => {
                    if (!inviteCopied) {
                      event.currentTarget.style.background = "transparent";
                      event.currentTarget.style.color = "white";
                      event.currentTarget.style.transform = "translate(.5px,-.5px)"; // 元の位置
                      event.currentTarget.style.boxShadow = "2px 3px 0 rgba(0,0,0,0.72)";
                    }
                  }}
                  onMouseDown={(event) => {
                    event.currentTarget.style.transform = "translate(0,0)"; // 押し込み
                    event.currentTarget.style.boxShadow = "1px 2px 0 rgba(0,0,0,0.85)";
                  }}
                  onMouseUp={(event) => {
                    event.currentTarget.style.transform = inviteCopied ? "translate(0,0)" : "translate(0,-1px)";
                    event.currentTarget.style.boxShadow = "3px 4px 0 rgba(0,0,0,0.72)";
                  }}
                >
                  {inviteCopied ? "✓ コピーしました！" : "◆ リンクを コピー"}
                </button>
              </VStack>
            </Box>
          ) : (
            <Box p={MODAL_BODY_PADDING} position="relative" zIndex={20}>
              <form
                autoComplete="off"
                onSubmit={(event) => event.preventDefault()}
                style={{ display: "contents" }}
              >
                <VStack gap={4} align="stretch">
                  {!user && (
                  <Box
                    p={4}
                    bg="richBlack.700"
                    border="2px solid white"
                    borderRadius={0}
                  >
                    <VStack align="start" gap={2}>
                      <Text
                        fontSize="sm"
                        color="rgba(255,255,255,0.95)"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textShadow="0 2px 4px rgba(0,0,0,0.8)"
                      >
                        ⚠ おしらせ
                      </Text>
                      <Text
                        fontSize="sm"
                        color="white"
                        fontFamily="monospace"
                        lineHeight={1.6}
                        textShadow="1px 1px 0px #000"
                      >
                        なまえが みとうろく です。 先に とうろく を おねがいします。
                      </Text>
                    </VStack>
                  </Box>
                )}

                <Field.Root>
                  <Field.Label
                    css={{
                      fontSize: "0.95rem",
                      fontWeight: "bold",
                      color: "rgba(255,255,255,0.95)",
                      marginBottom: "8px",
                      fontFamily: "monospace",
                      textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                    }}
                  >
                    へやの なまえ
                  </Field.Label>
                  <Input
                    placeholder="れい: 友達とあそぶ"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={24}
                    css={{
                      height: "48px",
                      background: "white",
                      border: "borders.retrogameInput",
                      borderRadius: 0,
                      fontSize: "1rem",
                      padding: "0 16px",
                      color: "black",
                      fontWeight: "normal",
                      fontFamily: "monospace",
                      transition: "none",
                      _placeholder: {
                        color: "#666",
                        fontFamily: "monospace",
                      },
                      _focus: {
                        borderColor: "black",
                        boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                        background: "#f8f8f8",
                        outline: "none",
                      },
                      _hover: {
                        background: "#f8f8f8",
                      },
                    }}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label
                    css={{
                      fontSize: "0.95rem",
                      fontWeight: "bold",
                      color: "rgba(255,255,255,0.95)",
                      marginBottom: "8px",
                      fontFamily: "monospace",
                      textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                    }}
                  >
                    🔒 かぎを かける
                  </Field.Label>
                  <HStack align="center" gap={3}>
                    <Switch.Root
                      checked={enablePassword}
                      onCheckedChange={(details) => setEnablePassword(details.checked)}
                      css={{
                        "& [data-part='control']": {
                          background: enablePassword ? "#22C55E" : "#6B7280",
                          border: "3px solid rgba(255,255,255,0.9)",
                          borderRadius: 0,
                          boxShadow: "0 4px 0px 0px #000000",
                          width: "48px",
                          height: "24px",
                          transition: "all 0.2s ease",
                          cursor: "pointer",
                          "&:hover": {
                            background: enablePassword ? "#16A34A" : "#4B5563",
                            boxShadow: "0 2px 0px 0px #000000",
                            transform: "translateY(2px)",
                          },
                          "&::before": {
                            content: '""',
                            position: "absolute",
                            top: "2px",
                            left: enablePassword ? "22px" : "2px",
                            width: "16px",
                            height: "16px",
                            background: "white",
                            border: "2px solid rgba(0,0,0,0.3)",
                            borderRadius: 0,
                            transition: "left 0.2s ease",
                            boxShadow: "1px 1px 0px 0px #000000",
                          }
                        }
                      }}
                    >
                      <Switch.HiddenInput />
                      <Switch.Control />
                    </Switch.Root>
                    <Text fontSize="sm" color="whiteAlpha.80" fontFamily="monospace">
                      パスワードを設定すると入室時に入力が必要になります
                    </Text>
                  </HStack>
                </Field.Root>

                {enablePassword && (
                  <VStack align="stretch" gap={4}>
                    <VStack gap={2}>
                      <Text
                        fontSize="sm"
                        color="rgba(255,255,255,0.95)"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textShadow="0 2px 4px rgba(0,0,0,0.8)"
                        textAlign="center"
                      >
                        4けたの ひみつ ばんごう
                      </Text>
                      <GamePasswordInput
                        value={password}
                        onChange={setPassword}
                        error={!!passwordError}
                      />
                    </VStack>

                    {passwordError ? (
                      <Text
                        fontSize="xs"
                        color="dangerSolid"
                        fontFamily="monospace"
                        textAlign="center"
                        textShadow="1px 1px 0px #000"
                      >
                        {passwordError}
                      </Text>
                    ) : (
                      <Text
                        fontSize="xs"
                        color="whiteAlpha.70"
                        fontFamily="monospace"
                        textAlign="center"
                        textShadow="1px 1px 0px #000"
                      >
                      ※ 4桁の数字で設定されます
                      </Text>
                    )}
                  </VStack>
                )}

                <Field.Root>
                  <Field.Label
                    css={{
                      fontSize: "0.95rem",
                      fontWeight: "bold",
                      color: "rgba(255,255,255,0.95)",
                      marginBottom: "9px",
                      fontFamily: "monospace",
                      textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                    }}
                  >
                    待機エリア 表示設定
                  </Field.Label>
                  <Text
                    fontSize="xs"
                    color="rgba(255,255,255,0.7)"
                    mb={2}
                    fontFamily="monospace"
                    textShadow="1px 1px 0px #000"
                  >
                    待機中のプレイヤーカードをどう表示するか
                  </Text>
                  <HStack gap={2} role="radiogroup" aria-label="カード表示モード" w="100%">
                    <button
                      type="button"
                      onClick={() => setDisplayMode("full")}
                      style={getDisplayModeButtonStyle(displayMode === "full")}
                      role="radio"
                      aria-checked={displayMode === "full"}
                      tabIndex={displayMode === "full" ? 0 : -1}
                      onMouseEnter={(e) => handleDisplayModeHover(e, displayMode === "full", true)}
                      onMouseLeave={(e) => handleDisplayModeHover(e, displayMode === "full", false)}
                    >
                      🤝 みんな
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayMode("minimal")}
                      style={getDisplayModeButtonStyle(displayMode === "minimal")}
                      role="radio"
                      aria-checked={displayMode === "minimal"}
                      tabIndex={displayMode === "minimal" ? 0 : -1}
                      onMouseEnter={(e) => handleDisplayModeHover(e, displayMode === "minimal", true)}
                      onMouseLeave={(e) => handleDisplayModeHover(e, displayMode === "minimal", false)}
                    >
                      👤 自分
                    </button>
                  </HStack>
                </Field.Root>
              </VStack>
            </form>
            </Box>
          )}

          {/* Footer - ドラクエ風 */}
          <Box
            p={MODAL_FOOTER_PADDING}
            pt={0}
            position="relative"
            zIndex={20}
            css={{
              borderTop: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            }}
          >
            {isSuccess ? (
              <HStack justify="space-between" gap={3} mt={4}>
                <button
                  onClick={handleReset}
                  style={{
                    minWidth: "140px",
                    height: "40px",
                    borderRadius: 0,
                    fontWeight: "bold",
                    fontSize: "1rem",
                    fontFamily: "monospace",
                    border: "borders.retrogameThin",
                    background: "transparent",
                    color: "white",
                    cursor: "pointer",
                    textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                    transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.color = "black";
                    e.currentTarget.style.textShadow = "none";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "white";
                    e.currentTarget.style.textShadow = UI_TOKENS.TEXT_SHADOWS.soft;
                  }}
                >
                  もどる
                </button>
                <HStack gap={3}>
                  <button
                    onClick={onClose}
                    style={{
                      minWidth: "120px",
                      height: "40px",
                      borderRadius: 0,
                      fontWeight: "bold",
                      fontSize: "1rem",
                      fontFamily: "monospace",
                      border: "borders.retrogameThin",
                      background: "transparent",
                      color: "white",
                      cursor: "pointer",
                      textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                      transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.color = "black";
                      e.currentTarget.style.textShadow = "none";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "white";
                      e.currentTarget.style.textShadow = UI_TOKENS.TEXT_SHADOWS.soft;
                    }}
                  >
                    とじる
                  </button>
                  <button
                    onClick={handleEnterRoom}
                    style={{
                      minWidth: "160px",
                      height: "40px",
                      borderRadius: 0,
                      fontWeight: "bold",
                      fontSize: "1rem",
                      fontFamily: "monospace",
                      border: "borders.retrogameThin",
                      background: "var(--colors-richBlack-600)",
                      color: "white",
                      cursor: "pointer",
                      textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                      transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.color = "black";
                      e.currentTarget.style.textShadow = "none";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--colors-richBlack-600)";
                      e.currentTarget.style.color = "white";
                      e.currentTarget.style.textShadow = UI_TOKENS.TEXT_SHADOWS.soft;
                    }}
                  >
                    へやへ すすむ
                  </button>
                </HStack>
              </HStack>
            ) : (
              <HStack justify="space-between" gap={3} mt={4}>
                <button
                  onClick={onClose}
                  style={{
                    minWidth: "120px",
                    height: "40px",
                    borderRadius: 0,
                    fontWeight: "bold",
                    fontSize: "1rem",
                    fontFamily: "monospace",
                    border: "borders.retrogameThin",
                    background: "transparent",
                    color: "white",
                    cursor: "pointer",
                    textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                    transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.color = "black";
                    e.currentTarget.style.textShadow = "none";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "white";
                    e.currentTarget.style.textShadow = UI_TOKENS.TEXT_SHADOWS.soft;
                  }}
                >
                  やめる
                </button>

                <button
                  onClick={handleCreate}
                  disabled={!canSubmit}
                  style={{
                    minWidth: "140px",
                    height: "40px",
                    borderRadius: 0,
                    fontWeight: "bold",
                    fontSize: "1rem",
                    fontFamily: "monospace",
                    border: "borders.retrogameThin",
                    background: !canSubmit
                      ? "#666"
                      : "var(--colors-richBlack-600)",
                    color: "white",
                    cursor: !canSubmit ? "not-allowed" : "pointer",
                    textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                    transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                    opacity: !canSubmit ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (canSubmit) {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.color = "black";
                      e.currentTarget.style.textShadow = "none";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (canSubmit) {
                      e.currentTarget.style.background = "var(--colors-richBlack-600)";
                      e.currentTarget.style.color = "white";
                      e.currentTarget.style.textShadow = UI_TOKENS.TEXT_SHADOWS.soft;
                    }
                  }}
                >
                  {submitting ? "さくせい中..." : "作成"}
                </button>
              </HStack>
            )}
          </Box>
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

type RoomCreatePayload = Omit<RoomDoc, "creatorId"> &
  Partial<Pick<RoomDoc, "creatorId">>;

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
