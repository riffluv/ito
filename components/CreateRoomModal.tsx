"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { useAuth } from "@/context/AuthContext";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import type { PlayerDoc, RoomDoc, RoomOptions } from "@/lib/types";
import { randomAvatar } from "@/lib/utils";
import {
  Box,
  Dialog,
  Field,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { AlertCircle, Sparkles, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const [name, setName] = useState("");
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
    if (!name.trim()) {
      notify({ title: "部屋名を入力してください", type: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      const options: RoomOptions = {
        allowContinueAfterFail: true, // デフォルト: 最後まで並べる
        resolveMode: "sort-submit", // デフォルト: 一括提出方式
        defaultTopicType: "通常版", // ワンクリック開始のデフォルト
      };
      const room: RoomDoc = {
        name: name.trim(),
        hostId: user.uid,
        options,
        status: "waiting", // 新規作成時は待機
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        closedAt: null,
        expiresAt: null,
        topic: null,
        topicOptions: null,
        topicBox: null,
        result: null,
      };
      const roomRef = await addDoc(collection(db!, "rooms"), room);
      const pdoc: PlayerDoc = {
        name: displayName || "プレイヤー",
        avatar: randomAvatar(displayName || user.uid.slice(0, 6)),
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0,
        uid: user.uid,
        lastSeen: serverTimestamp(),
      };
      await setDoc(doc(db!, "rooms", roomRef.id, "players", user.uid), pdoc);
      onClose();
      try {
        (window as any).requestIdleCallback?.(() => {
          try {
            (router as any)?.prefetch?.(`/rooms/${roomRef.id}`);
          } catch {}
        });
      } catch {}
      onCreated?.(roomRef.id);
    } catch (e: any) {
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
            background: "richBlack.800", // リッチブラック
            border: "borders.retrogame", // ドラクエ風統一ボーダー
            borderRadius: 0, // 角ばった
            boxShadow: "none", // 影なし
            maxWidth: "480px",
            width: "90vw",
            padding: 0,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Close button - ドラクエ風 */}
          <IconButton
            aria-label="閉じる"
            onClick={onClose}
            size="sm"
            variant="ghost"
            css={{
              position: "absolute",
              top: "12px",
              right: "12px",
              zIndex: 10,
              borderRadius: 0, // 角ばった
              background: "transparent",
              color: "white",
              border: "borders.retrogameThin",
              width: "32px",
              height: "32px",
              transition: "all 0.1s ease",
              _hover: {
                background: "white",
                color: "richBlack.800",
              },
            }}
          >
            <X size={16} />
          </IconButton>

          {/* Header - ドラクエ風 */}
          <Box p={6} position="relative" zIndex={1} borderBottom="borders.retrogameThin">
            <VStack gap={2} align="center">
              <Dialog.Title
                css={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "white",
                  margin: 0,
                  textAlign: "center",
                  fontFamily: "monospace", // ドラクエっぽいフォント
                  textShadow: "1px 1px 0px #000",
                }}
              >
                ルームを つくる
              </Dialog.Title>
              <Text
                fontSize="sm"
                color="white"
                fontWeight="normal"
                textAlign="center"
                fontFamily="monospace"
                textShadow="1px 1px 0px #000"
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
                      なまえが みとうろく です。
                      あとで せっていを おすすめします。
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
                  placeholder="れい: ともだちと ITOゲーム"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                      boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.2)",
                      background: "#f8f8f8",
                      outline: "none",
                    },
                    _hover: {
                      background: "#f8f8f8",
                    },
                  }}
                />
              </Field.Root>
            </VStack>
          </Box>

          {/* Footer - ドラクエ風 */}
          <Box p={4} pt={0} position="relative" zIndex={1} borderTop="borders.retrogameThin">
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
                  textShadow: "1px 1px 0px #000",
                  transition: "all 0.1s ease",
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
                  background: submitting || !name.trim() ? "#666" : "var(--colors-richBlack-600)",
                  color: "white",
                  cursor: submitting || !name.trim() ? "not-allowed" : "pointer",
                  textShadow: "1px 1px 0px #000",
                  transition: "all 0.1s ease",
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
                    e.currentTarget.style.background = "var(--colors-richBlack-600)";
                    e.currentTarget.style.color = "white";
                  }
                }}
              >
                {submitting ? "つくっています..." : "つくる"}
              </button>
            </HStack>
          </Box>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
