"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, Text, VStack, HStack, Button } from "@chakra-ui/react";
import { GamePasswordInput } from "@/components/ui/GamePasswordInput";

export type RoomPasswordPromptProps = {
  isOpen: boolean;
  roomName?: string;
  isLoading?: boolean;
  error?: string | null;
  onSubmit: (password: string) => Promise<void> | void;
  onCancel: () => void;
};

export function RoomPasswordPrompt({
  isOpen,
  roomName,
  isLoading = false,
  error,
  onSubmit,
  onCancel,
}: RoomPasswordPromptProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setValue("");
    }
  }, [isOpen]);

  const handleSubmit = useCallback(() => {
    if (isLoading) return;
    const trimmed = value.trim();
    if (trimmed.length !== 4) return;
    onSubmit(trimmed);
  }, [isLoading, onSubmit, value]);

  const canSubmit = value.trim().length === 4 && !isLoading;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(details) => !details.open && onCancel()}>
      <Dialog.Backdrop
        css={{
          backdropFilter: "blur(6px)",
          background: "rgba(0,0,0,0.5)",
        }}
      />
      <Dialog.Positioner>
        <Dialog.Content
          css={{
            background: "rgba(8,9,15,0.9)",
            border: "3px solid rgba(255,255,255,0.85)",
            borderRadius: 0,
            width: "min(400px, 90vw)",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.6)",
          }}
        >
          <Dialog.Header px={6} py={4} borderBottom="1px solid rgba(255,255,255,0.25)">
            <Dialog.Title
              css={{
                fontFamily: "monospace",
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "white",
                textShadow: "1px 1px 0 rgba(0,0,0,0.6)",
              }}
            >
              鍵付きルーム
            </Dialog.Title>
            <Dialog.CloseTrigger
              css={{
                border: "1px solid rgba(255,255,255,0.5)",
                borderRadius: 0,
                background: "transparent",
                color: "white",
                fontFamily: "monospace",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              ✕
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body px={6} py={5}>
            <VStack align="stretch" gap={4}>
              <input type="text" name="roomKeyPromptDummy" autoComplete="username" style={{ display: "none" }} />
              <input type="password" name="roomKeyPromptHidden" autoComplete="new-password" style={{ display: "none" }} />
              <Text fontSize="sm" color="white" fontFamily="monospace">
                {roomName ? `「${roomName}」に入室するにはパスワードが必要です。` : "この部屋は鍵がかかっています。"}
              </Text>
              <VStack gap={2} align="stretch">
                <Text
                  fontSize="sm"
                  color="white"
                  fontFamily="monospace"
                  textShadow="1px 1px 0px #000"
                >
                  ▼ 4桁の ひみつ ばんごう
                </Text>
                <GamePasswordInput
                  value={value}
                  onChange={setValue}
                  disabled={isLoading}
                  error={!!error}
                  autoFocus
                  onEnter={handleSubmit}
                />
              </VStack>

              {error ? (
                <Text fontSize="xs" color="var(--colors-dangerSolid)" fontFamily="monospace">
                  {error}
                </Text>
              ) : (
                <Text fontSize="xs" color="whiteAlpha.70" fontFamily="monospace">
                  ※ ホストに確認した 4桁の番号を入力してください
                </Text>
              )}
              </VStack>
          </Dialog.Body>
          <Dialog.Footer px={6} py={4} borderTop="1px solid rgba(255,255,255,0.25)">
            <HStack justify="flex-end" gap={3}>
              <Button
                variant="outline"
                borderRadius={0}
                onClick={onCancel}
                disabled={isLoading}
              >
                やめる
              </Button>
              <Button
                colorScheme="purple"
                borderRadius={0}
                onClick={handleSubmit}
                loading={isLoading}
                disabled={!canSubmit}
              >
                入室する
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}


