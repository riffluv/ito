"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { db } from "@/lib/firebase/client";
import type { RoomDoc } from "@/lib/types";
import { Dialog, HStack, Stack, Text, VStack, Box } from "@chakra-ui/react";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { FiSettings, FiUsers, FiZap } from "react-icons/fi";

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
  const [defaultTopicType, setDefaultTopicType] = useState<string>(
    currentOptions?.defaultTopicType || "通常版"
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
        "options.defaultTopicType": defaultTopicType,
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
    },
    {
      value: "sort-submit",
      title: "一括判定モード", 
      description: "全員カードを並べてから判定",
    },
  ];

  const topicTypeOptions = [
    {
      value: "通常版",
      title: "通常版",
      description: "バランスの取れた定番のお題",
    },
    {
      value: "レインボー版", 
      title: "レインボー版",
      description: "カラフルで創造的なお題",
    },
    {
      value: "クラシック版",
      title: "クラシック版", 
      description: "シンプルで分かりやすいお題",
    },
  ];

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => !details.open && onClose()}
    >
      <Dialog.Backdrop bg="blackAlpha.800" />
      <Dialog.Positioner>
        <Dialog.Content 
          maxW="md" 
          bg="gray.900"
          borderRadius="xl"
          border="1px solid"
          borderColor="gray.700"
          boxShadow="xl"
        >
          <Dialog.Header px={6} py={5}>
            <Dialog.Title>
              <Text fontSize="xl" fontWeight="600" color="white">
                ゲーム設定
              </Text>
            </Dialog.Title>
          </Dialog.Header>

          <Dialog.Body px={6} pb={2}>
            <Stack gap={6}>
              {/* クリア方式セクション */}
              <Box>
                <Text fontSize="sm" fontWeight="600" color="gray.300" mb={3}>
                  クリア方式
                </Text>
                <Stack gap={2}>
                  {modeOptions.map((option) => {
                    const isSelected = resolveMode === option.value;
                    return (
                      <Box
                        key={option.value}
                        cursor="pointer"
                        onClick={() => setResolveMode(option.value)}
                        p={4}
                        borderRadius="lg"
                        border="1px solid"
                        borderColor={isSelected ? "blue.400" : "gray.700"}
                        bg={isSelected ? "blue.900" : "gray.800"}
                        transition="all 0.2s"
                        _hover={{ 
                          borderColor: isSelected ? "blue.300" : "gray.600",
                          bg: isSelected ? "blue.800" : "gray.750"
                        }}
                      >
                        <HStack justify="space-between" align="start">
                          <VStack align="start" gap={1} flex="1">
                            <Text
                              fontSize="md"
                              fontWeight="600"
                              color="white"
                            >
                              {option.title}
                            </Text>
                            <Text
                              fontSize="sm"
                              color="gray.400"
                              lineHeight="short"
                            >
                              {option.description}
                            </Text>
                          </VStack>
                          <Box
                            w={4}
                            h={4}
                            borderRadius="full"
                            border="2px solid"
                            borderColor={isSelected ? "blue.400" : "gray.500"}
                            bg={isSelected ? "blue.400" : "transparent"}
                            mt={0.5}
                            position="relative"
                          >
                            {isSelected && (
                              <Box
                                position="absolute"
                                top="50%"
                                left="50%"
                                transform="translate(-50%, -50%)"
                                w="6px"
                                h="6px"
                                borderRadius="full"
                                bg="white"
                              />
                            )}
                          </Box>
                        </HStack>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>

              {/* お題タイプセクション */}
              <Box>
                <Text fontSize="sm" fontWeight="600" color="gray.300" mb={3}>
                  デフォルトお題タイプ
                </Text>
                <Stack gap={2}>
                  {topicTypeOptions.map((option) => {
                    const isSelected = defaultTopicType === option.value;
                    return (
                      <Box
                        key={option.value}
                        cursor="pointer"
                        onClick={() => setDefaultTopicType(option.value)}
                        p={4}
                        borderRadius="lg"
                        border="1px solid"
                        borderColor={isSelected ? "blue.400" : "gray.700"}
                        bg={isSelected ? "blue.900" : "gray.800"}
                        transition="all 0.2s"
                        _hover={{ 
                          borderColor: isSelected ? "blue.300" : "gray.600",
                          bg: isSelected ? "blue.800" : "gray.750"
                        }}
                      >
                        <HStack justify="space-between" align="start">
                          <VStack align="start" gap={1} flex="1">
                            <Text
                              fontSize="md"
                              fontWeight="600"
                              color="white"
                            >
                              {option.title}
                            </Text>
                            <Text
                              fontSize="sm"
                              color="gray.400"
                              lineHeight="short"
                            >
                              {option.description}
                            </Text>
                          </VStack>
                          <Box
                            w={4}
                            h={4}
                            borderRadius="full"
                            border="2px solid"
                            borderColor={isSelected ? "blue.400" : "gray.500"}
                            bg={isSelected ? "blue.400" : "transparent"}
                            mt={0.5}
                            position="relative"
                          >
                            {isSelected && (
                              <Box
                                position="absolute"
                                top="50%"
                                left="50%"
                                transform="translate(-50%, -50%)"
                                w="6px"
                                h="6px"
                                borderRadius="full"
                                bg="white"
                              />
                            )}
                          </Box>
                        </HStack>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>

              {(!isHost || roomStatus !== "waiting") && (
                <Box
                  p={3}
                  bg="yellow.900"
                  borderRadius="md"
                  border="1px solid"
                  borderColor="yellow.700"
                >
                  <Text fontSize="sm" color="yellow.300" textAlign="center">
                    {!isHost
                      ? "設定の変更はホストのみ可能です"
                      : "設定の変更は待機中のみ可能です"}
                  </Text>
                </Box>
              )}
            </Stack>
          </Dialog.Body>

          <Dialog.Footer px={6} py={4} borderTop="1px solid" borderColor="gray.700">
            <HStack w="full" justify="flex-end" gap={3}>
              <AppButton 
                variant="ghost" 
                onClick={onClose}
                color="gray.400"
                _hover={{ bg: "gray.800", color: "white" }}
              >
                キャンセル
              </AppButton>
              <AppButton
                bg="blue.600"
                color="white"
                onClick={handleSave}
                loading={saving}
                disabled={!isHost || roomStatus !== "waiting" || saving}
                _hover={{ bg: "blue.500" }}
              >
                保存
              </AppButton>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

export default SettingsModal;