"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { RoomDoc } from "@/lib/types";
import {
  Dialog,
  HStack,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FiSettings, FiZap, FiUsers } from "react-icons/fi";
import { useState } from "react";

export type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentOptions: RoomDoc["options"];
  isHost: boolean;
  roomStatus: string;
};

export function SettingsModal({
  isOpen,
  onClose,
  roomId,
  currentOptions,
  isHost,
  roomStatus,
}: SettingsModalProps) {
  const [resolveMode, setResolveMode] = useState<string>(
    currentOptions?.resolveMode || "sequential"
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!isHost) {
      notify({ title: "ホストのみ設定を変更できます", type: "warning" });
      return;
    }

    if (roomStatus !== "waiting") {
      notify({
        title: "待機中のみ設定を変更できます",
        type: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db!, "rooms", roomId), {
        "options.resolveMode": resolveMode,
      });
      notify({ title: "設定を保存しました", type: "success" });
      onClose();
    } catch (err: any) {
      notify({
        title: "設定の保存に失敗しました",
        description: err?.message,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const modeOptions = [
    {
      value: "sequential",
      title: "順次判定モード",
      description: "カードを出すたびに即座に判定",
      icon: <FiZap />,
      subtitle: "スピーディー",
    },
    {
      value: "sort-submit",
      title: "一括判定モード", 
      description: "全員カードを並べてからまとめて判定",
      icon: <FiUsers />,
      subtitle: "戦略的",
    },
  ];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="lg">
          <Dialog.Header>
            <Dialog.Title>
              <HStack>
                <FiSettings />
                <Text>ゲーム設定</Text>
              </HStack>
            </Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap={6}>
              <VStack align="start" gap={2}>
                <Text fontWeight="bold" fontSize="md">
                  クリア方式
                </Text>
                <Text fontSize="sm" color="gray.400">
                  ゲーム進行のルールを選択してください
                </Text>
              </VStack>

              <Stack gap={3}>
                {modeOptions.map((option) => (
                  <AppButton
                    key={option.value}
                    variant={resolveMode === option.value ? "solid" : "outline"}
                    colorPalette={resolveMode === option.value ? "orange" : "gray"}
                    onClick={() => setResolveMode(option.value)}
                    w="100%"
                    h="auto"
                    p={4}
                    justifyContent="flex-start"
                    disabled={!isHost || roomStatus !== "waiting"}
                  >
                    <HStack w="100%" gap={3}>
                      <VStack align="center" gap={1} minW="50px">
                        <Text fontSize="2xl">{option.icon}</Text>
                        <Text fontSize="xs" fontWeight="bold">
                          {option.subtitle}
                        </Text>
                      </VStack>
                      <VStack align="start" gap={1} flex="1">
                        <Text fontWeight="bold" fontSize="md">
                          {option.title}
                        </Text>
                        <Text fontSize="sm" opacity={0.8}>
                          {option.description}
                        </Text>
                      </VStack>
                    </HStack>
                  </AppButton>
                ))}
              </Stack>

              {(!isHost || roomStatus !== "waiting") && (
                <Text fontSize="sm" color="gray.400" textAlign="center">
                  {!isHost
                    ? "設定の変更はホストのみ可能です"
                    : "設定の変更は待機中のみ可能です"}
                </Text>
              )}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <AppButton variant="ghost" onClick={onClose}>
              キャンセル
            </AppButton>
            <AppButton
              colorPalette="orange"
              onClick={handleSave}
              loading={saving}
              disabled={!isHost || roomStatus !== "waiting" || saving}
            >
              保存
            </AppButton>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

export default SettingsModal;