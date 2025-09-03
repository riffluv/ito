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
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
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
      <Dialog.Backdrop
        css={{
          background: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(8px)",
        }}
      />
      <Dialog.Positioner>
        <Dialog.Content
          css={{
            background: "{colors.surfaceRaised}",
            border: "1px solid {colors.borderStrong}",
            borderRadius: "20px",
            boxShadow:
              "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            maxWidth: "420px",
            width: "90vw",
            padding: 0,
            overflow: "hidden",
          }}
        >
          <Dialog.CloseTrigger
            css={{
              position: "absolute",
              top: "16px",
              right: "16px",
              zIndex: 10,
              background: "rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              padding: "8px",
              border: "none",
              color: "{colors.fgMuted}",
              cursor: "pointer",
              transition: "all 0.2s ease",
              "&:hover": {
                background: "rgba(255, 255, 255, 0.2)",
                color: "{colors.fgDefault}",
              },
            }}
          />

          {/* Premium Header */}
          <Box
            p={6}
            pb={4}
            css={{
              background:
                "linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.05) 100%)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <HStack gap={3} align="center">
              <Box
                w={10}
                h={10}
                bg="linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)"
                borderRadius="12px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                boxShadow="0 4px 12px rgba(99,102,241,0.3)"
              >
                <Box w="50%" h="50%" bg="white" borderRadius="6px" />
              </Box>
              <Box>
                <Dialog.Title
                  css={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "{colors.fgDefault}",
                    margin: 0,
                    letterSpacing: "-0.025em",
                  }}
                >
                  新しいルームを作成
                </Dialog.Title>
                <Text fontSize="sm" color="{colors.fgMuted}" mt={1}>
                  友達と一緒にITOを楽しみましょう
                </Text>
              </Box>
            </HStack>
          </Box>

          <Box p={6}>
            <Stack gap={6}>
              {!user && (
                <Box
                  p={4}
                  bg="rgba(255, 193, 7, 0.1)"
                  border="1px solid rgba(255, 193, 7, 0.2)"
                  borderRadius="12px"
                >
                  <Text fontSize="sm" color="{colors.fgMuted}" lineHeight={1.6}>
                    まだサインインしていませんが、ルームは作成できます。
                    <br />
                    参加には後で名前の設定をおすすめします。
                  </Text>
                </Box>
              )}
              <Field.Root>
                <Field.Label
                  css={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "{colors.fgDefault}",
                    marginBottom: "8px",
                  }}
                >
                  ルーム名
                </Field.Label>
                <Input
                  placeholder="例: 友達とITOゲーム"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  css={{
                    height: "48px",
                    background: "{colors.surfaceSubtle}",
                    border: "2px solid {colors.borderDefault}",
                    borderRadius: "12px",
                    fontSize: "1rem",
                    padding: "0 16px",
                    color: "{colors.fgDefault}",
                    transition: "all 0.2s ease",
                    "&:focus": {
                      borderColor: "{colors.accent}",
                      boxShadow: "0 0 0 3px rgba(99,102,241,0.1)",
                      background: "{colors.surfaceRaised}",
                    },
                    "&::placeholder": {
                      color: "{colors.fgSubtle}",
                    },
                  }}
                />
              </Field.Root>
            </Stack>
          </Box>

          {/* Premium Footer */}
          <Box
            p={6}
            pt={4}
            css={{
              background: "rgba(255,255,255,0.02)",
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <HStack justify="flex-end" gap={3}>
              <AppButton
                onClick={onClose}
                visual="ghost"
                size="lg"
                css={{
                  minWidth: "80px",
                  height: "44px",
                  borderRadius: "12px",
                  fontWeight: 500,
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
                disabled={submitting}
                css={{
                  minWidth: "120px",
                  height: "44px",
                  borderRadius: "12px",
                  fontWeight: 600,
                  background: !submitting
                    ? "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)"
                    : undefined,
                  boxShadow: !submitting
                    ? "0 4px 16px rgba(99,102,241,0.4)"
                    : undefined,
                }}
              >
                {submitting ? "作成中..." : "ルームを作成"}
              </AppButton>
            </HStack>
          </Box>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
