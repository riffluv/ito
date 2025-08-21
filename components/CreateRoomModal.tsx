"use client";
import { notify } from "@/components/ui/notify";
import { useAuth } from "@/context/AuthContext";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import type { PlayerDoc, RoomDoc, RoomOptions } from "@/lib/types";
import { randomAvatar } from "@/lib/utils";
import { Button, Dialog, Field, Input, Stack, Switch } from "@chakra-ui/react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState } from "react";
// お題候補は部屋作成後に選択（TopicDisplay側で処理）

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
  const [allowContinueAfterFail, setAllowContinueAfterFail] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!firebaseEnabled) {
      notify({ title: "Firebase設定が見つかりません", type: "error" });
      return;
    }
    if (!user) {
      notify({
        title: "匿名ログインを完了するまでお待ちください",
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
      const options: RoomOptions = { allowContinueAfterFail };
      const room: RoomDoc = {
        name: name.trim(),
        hostId: user.uid,
        options,
        status: "waiting",
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        closedAt: null,
        expiresAt: null,
        topic: null,
        topicOptions: null,
        topicBox: null,
        result: null,
      };
      const roomRef = await addDoc(collection(db, "rooms"), room);
      // 自分をプレイヤーとして登録
      const pdoc: PlayerDoc = {
        name: displayName || "匿名",
        avatar: randomAvatar(displayName || user.uid.slice(0, 6)),
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0,
        uid: user.uid,
        lastSeen: serverTimestamp(),
      };
      await setDoc(doc(db, "rooms", roomRef.id, "players", user.uid), pdoc);
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
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>部屋を作る</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap={4}>
              {!user && (
                <Stack fontSize="sm" color="fgMuted">
                  <span>匿名ログインを初期化しています…</span>
                  <span>少し待ってから「作成」を押してください。</span>
                </Stack>
              )}
              <Field.Root>
                <Field.Label>部屋名</Field.Label>
                <Input
                  placeholder="例）皆でITO"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field.Root>
              <Field.Root orientation="horizontal">
                <Field.Label mb="0">失敗後に継続確認</Field.Label>
                <Switch.Root
                  checked={allowContinueAfterFail}
                  onCheckedChange={(d) => setAllowContinueAfterFail(d.checked)}
                >
                  <Switch.HiddenInput />
                  <Switch.Control />
                </Switch.Root>
              </Field.Root>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Button mr={3} onClick={onClose} variant="ghost">
              キャンセル
            </Button>
            <Button
              colorPalette="orange"
              variant="solid"
              onClick={handleCreate}
              loading={submitting}
              disabled={submitting}
            >
              作成
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
