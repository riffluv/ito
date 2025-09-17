"use client";
import { notify } from "@/components/ui/notify";
import { useAuth } from "@/context/AuthContext";
import { useTransition } from "@/components/ui/TransitionProvider";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import type { PlayerDoc, RoomDoc, RoomOptions } from "@/lib/types";
import { applyDisplayModeToName } from "@/lib/game/displayMode";
import { getAvatarByOrder } from "@/lib/utils";
import { Box, Dialog, Field, HStack, Input, Text, VStack } from "@chakra-ui/react";
import IconButtonDQ from "@/components/ui/IconButtonDQ";
import { addDoc, collection, doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
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

    setSubmitting(true);
    onClose(); // モーダルをすぐに閉じる

    try {
      // Firebase操作を実行してルームを作成
      let createdRoomId: string;

      // Firebase操作
      const options: RoomOptions = {
        allowContinueAfterFail: true,
        resolveMode: "sort-submit",
        displayMode,
        defaultTopicType: "通常版",
      };
      const expires = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const room: RoomDoc = {
        name: applyDisplayModeToName(sanitizedRoomName, displayMode),
        hostId: user.uid,
        hostName: sanitizedDisplayName || "匿名",
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
      };
      const roomRef = await addDoc(collection(db!, "rooms"), room);
      const pdoc: PlayerDoc = {
        name: sanitizedDisplayName,
        avatar: getAvatarByOrder(0),
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0,
        uid: user.uid,
        lastSeen: serverTimestamp(),
      };
      await setDoc(doc(db!, "rooms", roomRef.id, "players", user.uid), pdoc);
      createdRoomId = roomRef.id;

      // 新しい遷移システムを使って移動
      await transition.navigateWithTransition(
        `/rooms/${createdRoomId}`,
        {
          direction: "fade",
          duration: 1.2,
          showLoading: true,
          loadingSteps: [
            { id: "firebase", message: "せつぞく中です...", duration: 1500 },
            { id: "room", message: "ルームを さくせいしています...", duration: 2000 },
            { id: "player", message: "プレイヤーじょうほうを せっていしています...", duration: 1800 },
            { id: "ready", message: "じゅんびが かんりょうしました！", duration: 1000 },
          ],
        },
        async () => {
          // プリフェッチなどの最終処理
          try {
            (window as any).requestIdleCallback?.(() => {
              try {
                (router as any)?.prefetch?.(`/rooms/${createdRoomId}`);
              } catch {}
            });
          } catch {}
          onCreated?.(createdRoomId);
        }
      );
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
                ルームを作成
              </Dialog.Title>
              <Text
                fontSize="sm"
                color="white"
                fontWeight="normal"
                textAlign="center"
                fontFamily="monospace"
                textShadow={UI_TOKENS.TEXT_SHADOWS.soft as any}
              >
                あたらしい ぼうけんの はじまり
              </Text>
            </VStack>
          </Box>

          {/* Form Content - ドラクエ風 */}
          <Box px={6} py={6} position="relative" zIndex={1}>
            <VStack gap={4} align="stretch">
              {!user && (
                <Box
                  p={4}
                  bg="richBlack.700" // 少し明るいリッチブラック
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
                      なまえがみとうろく です。　先に とうろく
                      をおねがいします。
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
          </Box>

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
                disabled={submitting || !name.trim()}
                style={{
                  minWidth: "140px",
                  height: "40px",
                  borderRadius: 0,
                  fontWeight: "bold",
                  fontSize: "1rem",
                  fontFamily: "monospace",
                  border: "borders.retrogameThin",
                  background:
                    submitting || !name.trim()
                      ? "#666"
                      : "var(--colors-richBlack-600)",
                  color: "white",
                  cursor:
                    submitting || !name.trim() ? "not-allowed" : "pointer",
                  textShadow: UI_TOKENS.TEXT_SHADOWS.soft as any,
                  transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                  opacity: submitting || !name.trim() ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!submitting && name.trim()) {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.color = "var(--colors-richBlack-800)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitting && name.trim()) {
                    e.currentTarget.style.background =
                      "var(--colors-richBlack-600)";
                    e.currentTarget.style.color = "white";
                  }
                }}
              >
                {submitting ? "作成中..." : "作成"}
              </button>
            </HStack>
          </Box>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
