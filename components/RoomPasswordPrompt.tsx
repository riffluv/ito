"use client";

import { useState, useEffect } from "react";
import { Dialog, Field, Input, Text, VStack, HStack, Button } from "@chakra-ui/react";

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
            background: "var(--colors-richBlack-700)",
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
              <Field.Root>
                <Field.Label
                  css={{
                    fontFamily: "monospace",
                    color: "white",
                    marginBottom: "6px",
                  }}
                >
                  パスワード
                </Field.Label>
                <Input
                  type="text"
                  value={value}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="text"
                  aria-autocomplete="none"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  autoFocus
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !isLoading) {
                      event.preventDefault();
                      onSubmit(value);
                    }
                  }}
                  disabled={isLoading}
                  css={{
                    WebkitTextSecurity: "disc",
                    MozTextSecurity: "disc",
                    background: "white",
                    borderRadius: 0,
                    fontFamily: "monospace",
                    color: "var(--colors-richBlack-900)",
                    letterSpacing: "0.08em",
                    fontWeight: 600,
                  }}
                />
              </Field.Root>
              {error ? (
                <Text fontSize="xs" color="var(--colors-dangerSolid)" fontFamily="monospace">
                  {error}
                </Text>
              ) : (
                <Text fontSize="xs" color="whiteAlpha.70" fontFamily="monospace">
                  パスワードはホストに確認してください。
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
                isDisabled={isLoading}
              >
                やめる
              </Button>
              <Button
                colorScheme="purple"
                borderRadius={0}
                onClick={() => {
                  if (!isLoading && value.trim()) {
                    onSubmit(value);
                  }
                }}
                isLoading={isLoading}
                isDisabled={isLoading || value.trim().length === 0}
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
