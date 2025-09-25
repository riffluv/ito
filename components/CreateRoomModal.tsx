"use client";
import { notify } from "@/components/ui/notify";
import { useAuth } from "@/context/AuthContext";
import { useTransition } from "@/components/ui/TransitionProvider";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import type { PlayerDoc, RoomDoc, RoomOptions } from "@/lib/types";
import { applyDisplayModeToName } from "@/lib/game/displayMode";
import { AVATAR_LIST } from "@/lib/utils";
import { createPasswordEntry } from "@/lib/security/password";
import { storeRoomPasswordHash } from "@/lib/utils/roomPassword";
import { Box, Dialog, Field, HStack, Input, Switch, Text, VStack } from "@chakra-ui/react";
import IconButtonDQ from "@/components/ui/IconButtonDQ";
import { addDoc, collection, doc, serverTimestamp, setDoc, Timestamp, DocumentReference } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UI_TOKENS } from "@/theme/layout";
import { logError } from "@/lib/utils/log";
import { validateDisplayName, validateRoomName } from "@/lib/validation/forms";

export function CreateRoomModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (roomId: string) => void;
}) {
  const { user, displayName } = useAuth() as any;
  const router = useRouter();
  const transition = useTransition();
  const [name, setName] = useState("");
  const [displayMode, setDisplayMode] = useState<"full" | "minimal">("full");
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!enablePassword) {
      setPassword("");
      setPasswordConfirm("");
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
      setPasswordConfirm("");
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

  const invitePath = createdRoomId ? `/r/${createdRoomId}` : "";

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
    } catch (err: any) {
      notify({
        title: "部屋名を確認してください",
        description: err?.errors?.[0]?.message,
        type: "error",
      });
      return;
    }

    let sanitizedDisplayName: string;
    try {
      sanitizedDisplayName = validateDisplayName(displayName || "");
    } catch (err: any) {
      notify({
        title: "プレイヤー名を設定してください",
        description: err?.errors?.[0]?.message,
        type: "warning",
      });
      return;
    }

    if (enablePassword) {
      const trimmed = password.trim();
      if (trimmed.length < 4) {
        setPasswordError("パスワードは4文字以上で設定してください");
        return;
      }
      if (trimmed !== passwordConfirm.trim()) {
        setPasswordError("確認用のパスワードが一致しません");
        return;
      }
      setPasswordError(null);
    } else if (passwordError) {
      setPasswordError(null);
    }

    setSubmitting(true);

    try {
      const options: RoomOptions = {
        allowContinueAfterFail: true,
        resolveMode: "sort-submit",
        displayMode,
        defaultTopicType: "通常版",
      };
      let passwordEntry: { hash: string; salt: string; version: number } | null = null;
      if (enablePassword) {
        passwordEntry = await createPasswordEntry(password.trim());
      }
      const expires = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const baseRoomData: RoomDoc & Record<string, any> = {
        name: applyDisplayModeToName(sanitizedRoomName, displayMode),
        hostId: user.uid,
        hostName: sanitizedDisplayName || "匿名",
        creatorId: user.uid,
        creatorName: sanitizedDisplayName || "匿名",
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
        requiresPassword: enablePassword,
        passwordHash: passwordEntry?.hash ?? null,
        passwordSalt: passwordEntry?.salt ?? null,
        passwordVersion: passwordEntry?.version ?? null,
      };

      let roomRef: DocumentReference | null = null;
      try {
        roomRef = await addDoc(collection(db!, "rooms"), baseRoomData);
      } catch (error) {
        if (error instanceof FirebaseError && error.code === "permission-denied") {
          console.warn("[rooms] create-room without creator fields (fallback)", error);
          const fallbackPayload: Record<string, any> = { ...baseRoomData };
          delete fallbackPayload.creatorId;
          delete fallbackPayload.creatorName;
          roomRef = await addDoc(collection(db!, "rooms"), fallbackPayload);
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
      setPasswordConfirm("");
      onCreated?.(roomRef.id);
    } catch (e: any) {
      logError("rooms", "create-room", e);
      notify({
        title: "作成に失敗しました",
        description: e?.message,
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
    } catch (error) {
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
            { id: "room", message: "ルームに じゅんびしています...", duration: 2000 },
            { id: "player", message: "プレイヤーを とうろくしています...", duration: 1800 },
            { id: "ready", message: "じゅんびが かんりょうしました！", duration: 1000 },
          ],
        },
        async () => {
          try {
            (window as any).requestIdleCallback?.(() => {
              try {
                router.prefetch?.(targetUrl);
              } catch {}
            });
          } catch {}
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
    <Dialog.Root open={isOpen} onOpenChange={(d) => !d.open && onClose()}>
      {/* Sophisticated backdrop */}
      <Dialog.Backdrop
        css={{
          background: "overlayStrong",
          backdropFilter: "blur(12px) saturate(1.2)",
        }}
      />

      <Dialog.Positioner>
        <Dialog.Content
          css={{
            background: UI_TOKENS.COLORS.panelBg, // NameDialogと同じリッチブラック
            border: `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
            borderRadius: 0, // 角ばった統一
            boxShadow: UI_TOKENS.SHADOWS.panelDistinct,
            maxWidth: "480px",
            width: "90vw",
            padding: 0,
            overflow: "hidden",
            position: "relative",
          }}
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
              zIndex: 10,
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
            p={6}
            position="relative"
            zIndex={1}
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
                {isSuccess ? "ルームができました！" : "ルームを作成"}
              </Dialog.Title>
              <Text
                fontSize="sm"
                color="white"
                fontWeight="normal"
                textAlign="center"
                fontFamily="monospace"
                textShadow={UI_TOKENS.TEXT_SHADOWS.soft as any}
              >
                {isSuccess ? "なかまを さそって いざ ぼうけんへ" : "あたらしい ぼうけんの はじまり"}
              </Text>
            </VStack>
          </Box>

          {/* Form Content - ドラクエ風 */}
          {isSuccess ? (
            <Box px={6} py={6} position="relative" zIndex={1}>
              <VStack gap={5} align="stretch">
                <Box
                  p={4}
                  border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
                  borderRadius={0}
                  bg={UI_TOKENS.COLORS.panelBg}
                  boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
                >
                  <VStack align="start" gap={2}>
                    <Text
                      fontSize="lg"
                      fontWeight="bold"
                      color="white"
                      fontFamily="monospace"
                      textShadow="1px 1px 0px #000"
                    >
                      ▼ ルームが かんせい しました！
                    </Text>
                    <Text
                      fontSize="sm"
                      color="whiteAlpha.80"
                      fontFamily="monospace"
                      textShadow="1px 1px 0px #000"
                    >
                      なかまを さそって ぼうけんに でかけましょう。
                    </Text>
                  </VStack>
                </Box>

                <VStack align="stretch" gap={3}>
                  <Text
                    fontSize="sm"
                    color="white"
                    fontFamily="monospace"
                    textShadow="1px 1px 0 rgba(0,0,0,0.6)"
                  >
                    招待URL
                  </Text>
                  <Box
                    border="borders.retrogameThin"
                    borderColor="whiteAlpha.70"
                    bg="var(--colors-richBlack-700)"
                    p={3}
                    display="flex"
                    flexDirection={{ base: "column", md: "row" }}
                    gap={3}
                    alignItems={{ base: "stretch", md: "center" }}
                  >
                    <Text
                      flex={1}
                      fontSize="sm"
                      color="white"
                      fontFamily="monospace"
                      wordBreak="break-all"
                    >
                      {inviteUrl}
                    </Text>
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      style={{
                        minWidth: "130px",
                        borderRadius: 0,
                        border: `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
                        background: inviteCopied ? "white" : "transparent",
                        color: inviteCopied ? "var(--colors-richBlack-800)" : "white",
                        fontFamily: "monospace",
                        fontWeight: "bold",
                        padding: "8px 12px",
                        cursor: "pointer",
                        textShadow: inviteCopied ? "none" : "1px 1px 0px #000",
                        transition: "all 0.12s ease",
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = "white";
                        event.currentTarget.style.color = "var(--colors-richBlack-800)";
                      }}
                      onMouseLeave={(event) => {
                        if (!inviteCopied) {
                          event.currentTarget.style.background = "transparent";
                          event.currentTarget.style.color = "white";
                        }
                      }}
                    >
                      {inviteCopied ? "◆ コピーしました" : "◆ コピー"}
                    </button>
                  </Box>
                  <Text
                    fontSize="xs"
                    color="whiteAlpha.70"
                    fontFamily="monospace"
                    textShadow="1px 1px 0px #000"
                  >
                    ▼ ショートリンク: <strong>{invitePath}</strong>
                  </Text>
                  <Text
                    fontSize="xs"
                    color="whiteAlpha.60"
                    fontFamily="monospace"
                    textShadow="1px 1px 0px #000"
                  >
                    このリンクを ひらくと ルームに じどうで いどうします。
                  </Text>
                </VStack>
              </VStack>
            </Box>
          ) : (
            <Box px={6} py={6} position="relative" zIndex={1}>
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
                        color="white"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textShadow="1px 1px 0px #000"
                      >
                        ▼ おしらせ
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
                      fontSize: "1rem",
                      fontWeight: "bold",
                      color: "white",
                      marginBottom: "8px",
                      fontFamily: "monospace",
                      textShadow: "1px 1px 0px #000",
                    }}
                  >
                    ▼ ルームの なまえ
                  </Field.Label>
                  <Input
                    placeholder="れい: 友達とあそぶ"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={20}
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
                      fontSize: "1rem",
                      fontWeight: "bold",
                      color: "white",
                      marginBottom: "8px",
                      fontFamily: "monospace",
                      textShadow: "1px 1px 0px #000",
                    }}
                  >
                    ▼ 鍵をかける
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

                {enablePassword ? (
                  <VStack align="stretch" gap={3}>
                    <input type="text" name="roomKeyDummy" autoComplete="username" style={{ display: "none" }} />
                    <input type="password" name="roomKeyHidden" autoComplete="new-password" style={{ display: "none" }} />
                    <Input
                      type="text"
                      name="roomKey"
                      placeholder="パスワード (4文字以上)"
                      value={password}
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      inputMode="text"
                      aria-autocomplete="none"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                      onChange={(event) => setPassword(event.target.value)}
                      css={{
                        WebkitTextSecurity: "disc",
                        MozTextSecurity: "disc",
                        height: "44px",
                        background: "white",
                        border: "borders.retrogameInput",
                        borderRadius: 0,
                        fontFamily: "monospace",
                        color: "richBlack.900",
                        letterSpacing: "0.08em",
                        fontWeight: 600,
                      }}
                    />
                    <Input
                      type="text"
                      name="roomKeyConfirm"
                      placeholder="もう一度入力"
                      value={passwordConfirm}
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      inputMode="text"
                      aria-autocomplete="none"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                      onChange={(event) => setPasswordConfirm(event.target.value)}
                      css={{
                        WebkitTextSecurity: "disc",
                        MozTextSecurity: "disc",
                        height: "44px",
                        background: "white",
                        border: "borders.retrogameInput",
                        borderRadius: 0,
                        fontFamily: "monospace",
                        color: "richBlack.900",
                        letterSpacing: "0.08em",
                        fontWeight: 600,
                      }}
                    />
                    {passwordError ? (
                      <Text fontSize="xs" color="dangerSolid" fontFamily="monospace">
                        {passwordError}
                      </Text>
                    ) : (
                      <Text fontSize="xs" color="whiteAlpha.70" fontFamily="monospace">
                        友だちにだけパスワードを共有してください
                      </Text>
                    )}
                  </VStack>
                ) : null}

                <Field.Root>
                  <Field.Label
                    css={{
                      fontSize: "1rem",
                      fontWeight: "bold",
                      color: "white",
                      marginBottom: "8px",
                      fontFamily: "monospace",
                      textShadow: "1px 1px 0px #000",
                    }}
                  >
                    ▼ カード表示モード
                  </Field.Label>
                  <HStack gap={2} role="radiogroup" aria-label="カード表示モード" w="100%">
                    <button
                      type="button"
                      onClick={() => setDisplayMode("full")}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: "48px",
                        borderRadius: 0,
                        fontWeight: "bold",
                        fontSize: "0.9rem",
                        fontFamily: "monospace",
                        border: "2px solid white",
                        background: displayMode === "full" ? "white" : "transparent",
                        color: displayMode === "full" ? "black" : "white",
                        cursor: "pointer",
                        textShadow: displayMode === "full" ? "none" : "1px 1px 0px #000",
                        transition: "all 0.1s ease",
                        whiteSpace: "nowrap",
                        overflow: "visible",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 8px",
                      }}
                      role="radio"
                      aria-checked={displayMode === "full"}
                      tabIndex={displayMode === "full" ? 0 : -1}
                    >
                      🤝 みんな
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayMode("minimal")}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: "48px",
                        borderRadius: 0,
                        fontWeight: "bold",
                        fontSize: "0.9rem",
                        fontFamily: "monospace",
                        border: "2px solid white",
                        background: displayMode === "minimal" ? "white" : "transparent",
                        color: displayMode === "minimal" ? "black" : "white",
                        cursor: "pointer",
                        textShadow: displayMode === "minimal" ? "none" : "1px 1px 0px #000",
                        transition: "all 0.1s ease",
                        whiteSpace: "nowrap",
                        overflow: "visible",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 8px",
                      }}
                      role="radio"
                      aria-checked={displayMode === "minimal"}
                      tabIndex={displayMode === "minimal" ? 0 : -1}
                    >
                      👤 自分
                    </button>
                  </HStack>
                  <Text
                    fontSize="xs"
                    color="white"
                    mt={2}
                    fontFamily="monospace"
                    opacity={0.7}
                    textShadow="1px 1px 0px #000"
                  >
                    みんな: 全員のカード表示 / 自分: 自分のみ表示
                  </Text>
                </Field.Root>
              </VStack>
            </form>
            </Box>
          )}

          {/* Footer - ドラクエ風 */}
          <Box
            p={4}
            pt={0}
            position="relative"
            zIndex={1}
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
                    textShadow: UI_TOKENS.TEXT_SHADOWS.soft as any,
                    transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.color = "var(--colors-richBlack-800)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "white";
                  }}
                >
                  べつのルームを つくる
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
                      textShadow: UI_TOKENS.TEXT_SHADOWS.soft as any,
                      transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.color = "var(--colors-richBlack-800)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "white";
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
                      textShadow: UI_TOKENS.TEXT_SHADOWS.soft as any,
                      transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.color = "var(--colors-richBlack-800)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--colors-richBlack-600)";
                      e.currentTarget.style.color = "white";
                    }}
                  >
                    ルームへ すすむ
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
                    textShadow: UI_TOKENS.TEXT_SHADOWS.soft as any,
                    transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.color = "var(--colors-richBlack-800)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "white";
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
                    textShadow: UI_TOKENS.TEXT_SHADOWS.soft as any,
                    transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                    opacity: !canSubmit ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (canSubmit) {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.color = "var(--colors-richBlack-800)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (canSubmit) {
                      e.currentTarget.style.background = "var(--colors-richBlack-600)";
                      e.currentTarget.style.color = "white";
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











