"use client";
import { useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  Switch,
  Stack,
  useToast,
} from "@chakra-ui/react";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import type { RoomDoc, RoomOptions, PlayerDoc } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { randomAvatar } from "@/lib/utils";

export function CreateRoomModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated?: (roomId: string) => void; }) {
  const toast = useToast();
  const { user, displayName, loading } = useAuth() as any;
  const [name, setName] = useState("");
  const [allowSecondClue, setAllowSecondClue] = useState(true);
  const [passLimit, setPassLimit] = useState(2);
  const [allowContinueAfterFail, setAllowContinueAfterFail] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!firebaseEnabled) {
      toast({ title: "Firebase設定が見つかりません", status: "error" });
      return;
    }
    if (!user) {
      toast({ title: "匿名ログインを完了するまでお待ちください", status: "info" });
      return;
    }
    if (!name.trim()) {
      toast({ title: "部屋名を入力してください", status: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      const options: RoomOptions = { allowSecondClue, passLimit, allowContinueAfterFail };
      const room: RoomDoc = {
        name: name.trim(),
        hostId: user.uid,
        options,
        status: "waiting",
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        result: null,
      };
      const roomRef = await addDoc(collection(db, "rooms"), room);
      // 自分をプレイヤーとして登録
      const pdoc: PlayerDoc = {
        name: displayName || "匿名",
        avatar: randomAvatar(displayName || user.uid.slice(0, 6)),
        number: null,
        clue1: "",
        clue2: "",
        ready: false,
        orderIndex: 0,
        uid: user.uid,
      };
      await setDoc(doc(db, "rooms", roomRef.id, "players", user.uid), pdoc);
      onClose();
      onCreated?.(roomRef.id);
    } catch (e: any) {
      toast({ title: "作成に失敗しました", description: e?.message, status: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>部屋を作る</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            {!user && (
              <Stack fontSize="sm" color="gray.300">
                <span>匿名ログインを初期化しています…</span>
                <span>少し待ってから「作成」を押してください。</span>
              </Stack>
            )}
            <FormControl>
              <FormLabel>部屋名</FormLabel>
              <Input placeholder="例）皆でITO" value={name} onChange={(e) => setName(e.target.value)} />
            </FormControl>
            <FormControl display="flex" alignItems="center" justifyContent="space-between">
              <FormLabel mb="0">追加ヒントを許可</FormLabel>
              <Switch isChecked={allowSecondClue} onChange={(e) => setAllowSecondClue(e.target.checked)} />
            </FormControl>
            <FormControl>
              <FormLabel>パス上限</FormLabel>
              <NumberInput value={passLimit} min={0} max={5} onChange={(_, n) => setPassLimit(isNaN(n) ? 0 : n)}>
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl display="flex" alignItems="center" justifyContent="space-between">
              <FormLabel mb="0">失敗後に継続確認</FormLabel>
              <Switch isChecked={allowContinueAfterFail} onChange={(e) => setAllowContinueAfterFail(e.target.checked)} />
            </FormControl>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button mr={3} onClick={onClose} variant="ghost">キャンセル</Button>
          <Button colorScheme="blue" onClick={handleCreate} isLoading={submitting} isDisabled={submitting}>作成</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
