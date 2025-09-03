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
          background: "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(12px) saturate(1.2)",
        }}
      />

      <Dialog.Positioner>
        <Dialog.Content
          css={{
            background:
              "linear-gradient(135deg, rgba(15,16,20,0.98) 0%, rgba(25,27,33,0.98) 100%)",
            border: "1px solid rgba(107,115,255,0.2)",
            borderRadius: "24px",
            boxShadow: `
              0 32px 64px -12px rgba(0,0,0,0.8),
              0 20px 25px -5px rgba(0,0,0,0.4),
              inset 0 1px 0 rgba(255,255,255,0.1),
              0 0 0 1px rgba(107,115,255,0.1)
            `,
            maxWidth: "440px",
            width: "90vw",
            padding: 0,
            overflow: "hidden",
            position: "relative",
          }}
          _before={{
            content: '""',
            position: "absolute",
            inset: 0,
            borderRadius: "24px",
            background:
              "linear-gradient(135deg, rgba(107,115,255,0.08) 0%, rgba(153,69,255,0.04) 100%)",
            pointerEvents: "none",
          }}
        >
          {/* Close button */}
          <IconButton
            aria-label="閉じる"
            onClick={onClose}
            size="sm"
            variant="ghost"
            css={{
              position: "absolute",
              top: "20px",
              right: "20px",
              zIndex: 10,
              borderRadius: "12px",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.8)",
              transition: "all 0.2s ease",
              _hover: {
                background: "rgba(255,255,255,0.15)",
                color: "white",
                transform: "scale(1.05)",
              },
            }}
          >
            <X size={16} />
          </IconButton>

          {/* Header */}
          <Box p={8} pb={6} position="relative" zIndex={1}>
            <HStack gap={4} align="center" mb={4}>
              <Box
                w={14}
                h={14}
                borderRadius="16px"
                bg="linear-gradient(135deg, #6B73FF 0%, #9945FF 100%)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                boxShadow="0 8px 24px rgba(107,115,255,0.4)"
              >
                <Sparkles size={24} color="white" />
              </Box>

              <VStack align="start" gap={1}>
                <Dialog.Title
                  css={{
                    fontSize: "1.75rem",
                    fontWeight: 800,
                    color: "white",
                    margin: 0,
                    letterSpacing: "-0.02em",
                    fontFamily:
                      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
                  }}
                >
                  新しいルームを作成
                </Dialog.Title>
                <Text
                  fontSize="md"
                  color="rgba(255,255,255,0.7)"
                  fontWeight={500}
                >
                  友達と一緒にITOを楽しもう
                </Text>
              </VStack>
            </HStack>
          </Box>

          {/* Form Content */}
          <Box px={8} pb={8} position="relative" zIndex={1}>
            <VStack gap={6} align="stretch">
              {!user && (
                <Box
                  p={4}
                  bg="rgba(247,147,30,0.1)"
                  border="1px solid rgba(247,147,30,0.2)"
                  borderRadius="16px"
                  css={{
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <HStack gap={3}>
                    <AlertCircle size={20} color="#F7931E" />
                    <VStack align="start" gap={1}>
                      <Text fontSize="sm" color="white" fontWeight={600}>
                        未ログイン状態
                      </Text>
                      <Text
                        fontSize="sm"
                        color="rgba(255,255,255,0.8)"
                        lineHeight={1.5}
                      >
                        まだサインインしていませんが、ルームは作成できます。
                        後で名前の設定をおすすめします。
                      </Text>
                    </VStack>
                  </HStack>
                </Box>
              )}

              <Field.Root>
                <Field.Label
                  css={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: "white",
                    marginBottom: "12px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  ルーム名
                </Field.Label>
                <Input
                  placeholder="例: 友達とITOゲーム"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  css={{
                    height: "56px",
                    background: "rgba(255,255,255,0.05)",
                    border: "2px solid rgba(255,255,255,0.12)",
                    borderRadius: "16px",
                    fontSize: "1rem",
                    padding: "0 20px",
                    color: "white",
                    fontWeight: 500,
                    transition: "all 0.2s ease",
                    _placeholder: {
                      color: "rgba(255,255,255,0.5)",
                    },
                    _focus: {
                      borderColor: "#6B73FF",
                      boxShadow: "0 0 0 4px rgba(107,115,255,0.15)",
                      background: "rgba(255,255,255,0.08)",
                    },
                    _hover: {
                      borderColor: "rgba(255,255,255,0.2)",
                    },
                  }}
                />
              </Field.Root>
            </VStack>
          </Box>

          {/* Footer */}
          <Box p={8} pt={0} position="relative" zIndex={1}>
            <HStack justify="flex-end" gap={3}>
              <AppButton
                onClick={onClose}
                visual="ghost"
                size="lg"
                css={{
                  minWidth: "100px",
                  height: "48px",
                  borderRadius: "14px",
                  fontWeight: 500,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  transition: "all 0.2s ease",
                  _hover: {
                    background: "rgba(255,255,255,0.12)",
                    borderColor: "rgba(255,255,255,0.2)",
                  },
                }}
              >
                キャンセル
              </AppButton>

              <AppButton
                visual="solid"
                palette="brand"
                size="lg"
                onClick={handleCreate}
                loading={submitting}
                disabled={submitting || !name.trim()}
                css={{
                  minWidth: "140px",
                  height: "48px",
                  borderRadius: "14px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  background:
                    submitting || !name.trim()
                      ? "rgba(107,115,255,0.3)"
                      : "linear-gradient(135deg, #6B73FF 0%, #9945FF 100%)",
                  boxShadow:
                    submitting || !name.trim()
                      ? "none"
                      : "0 4px 20px rgba(107,115,255,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  _hover:
                    submitting || !name.trim()
                      ? {}
                      : {
                          transform: "translateY(-2px)",
                          background:
                            "linear-gradient(135deg, #8B92FF 0%, #B565FF 100%)",
                          boxShadow:
                            "0 8px 32px rgba(107,115,255,0.5), inset 0 1px 0 rgba(255,255,255,0.3)",
                        },
                  _active: {
                    transform: "translateY(0px)",
                  },
                }}
              >
                <Users size={18} style={{ marginRight: "8px" }} />
                {submitting ? "作成中..." : "ルームを作成"}
              </AppButton>
            </HStack>
          </Box>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
