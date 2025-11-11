"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, Text, VStack, HStack, Box } from "@chakra-ui/react";
import { GamePasswordInput } from "@/components/ui/GamePasswordInput";
import { UI_TOKENS } from "@/theme/layout";
import IconButtonDQ from "@/components/ui/IconButtonDQ";

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
          background: "overlayStrong",
          backdropFilter: "blur(12px) saturate(1.2)",
        }}
      />
      <Dialog.Positioner>
        <Dialog.Content
          css={{
            background: UI_TOKENS.COLORS.panelBg,
            border: `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
            borderRadius: 0,
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
            onClick={onCancel}
            size="sm"
            css={{
              position: "absolute",
              top: "12px",
              right: "12px",
              zIndex: 10,
              borderRadius: 0,
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
                }}
              >
                🔒 かぎつき へや
              </Dialog.Title>
              <Text
                fontSize="sm"
                color="white"
                fontWeight="normal"
                textAlign="center"
                fontFamily="monospace"
                textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
              >
                ひみつの ばんごうを いれてね
              </Text>
            </VStack>
          </Box>
          <Box px={6} py={6} position="relative" zIndex={1}>
            <VStack align="stretch" gap={4}>
              <input type="text" name="roomKeyPromptDummy" autoComplete="username" style={{ display: "none" }} />
              <input type="password" name="roomKeyPromptHidden" autoComplete="new-password" style={{ display: "none" }} />
              {roomName && (
                <Text
                  fontSize="sm"
                  color="rgba(255,255,255,0.85)"
                  fontFamily="monospace"
                  textAlign="center"
                  lineHeight="1.6"
                >
                  「{roomName}」へ ようこそ！
                </Text>
              )}
              <VStack gap={2} align="stretch">
                <Text
                  fontSize="sm"
                  color="rgba(255,255,255,0.95)"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textShadow="0 2px 4px rgba(0,0,0,0.8)"
                  textAlign="center"
                >
                  4けたの ひみつ ばんごう
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
                <Text
                  fontSize="xs"
                  color="var(--colors-dangerSolid)"
                  fontFamily="monospace"
                  textAlign="center"
                  textShadow="1px 1px 0px #000"
                >
                  {error}
                </Text>
              ) : (
                <Text
                  fontSize="xs"
                  color="rgba(255,255,255,0.7)"
                  fontFamily="monospace"
                  textAlign="center"
                  textShadow="0 1px 2px rgba(0,0,0,0.6)"
                >
                  ※ ホストに かくにんした ばんごうを いれてね
                </Text>
              )}
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
                onClick={onCancel}
                disabled={isLoading}
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
                  cursor: isLoading ? "not-allowed" : "pointer",
                  textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                  transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}`,
                  opacity: isLoading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.color = "black";
                    e.currentTarget.style.textShadow = "none";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "white";
                    e.currentTarget.style.textShadow = UI_TOKENS.TEXT_SHADOWS.soft;
                  }
                }}
              >
                やめる
              </button>

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  minWidth: "140px",
                  height: "40px",
                  borderRadius: 0,
                  fontWeight: "bold",
                  fontSize: "1rem",
                  fontFamily: "monospace",
                  border: "borders.retrogameThin",
                  background: !canSubmit ? "#666" : "rgba(126, 34, 206, 0.9)",
                  color: "white",
                  cursor: !canSubmit ? "not-allowed" : "pointer",
                  textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                  transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}`,
                  opacity: !canSubmit ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (canSubmit) {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.color = "black";
                    e.currentTarget.style.textShadow = "none";
                  }
                }}
                onMouseLeave={(e) => {
                  if (canSubmit) {
                    e.currentTarget.style.background = "rgba(126, 34, 206, 0.9)";
                    e.currentTarget.style.color = "white";
                    e.currentTarget.style.textShadow = UI_TOKENS.TEXT_SHADOWS.soft;
                  }
                }}
              >
                {isLoading ? "かくにん中..." : "にゅうしつ"}
              </button>
            </HStack>
          </Box>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}


