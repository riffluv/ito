"use client";

import { UI_TOKENS } from "@/theme/layout";
import { Box, Dialog, HStack, Input, Text, VStack } from "@chakra-ui/react";
import React from "react";
import { KEYBOARD_KEYS } from "../hints/constants";

type CustomTopicDialogProps = {
  open: boolean;
  value: string;
  interactionDisabled: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (value: string) => void;
};

export function CustomTopicDialog(props: CustomTopicDialogProps) {
  const { open, value, interactionDisabled, onChange, onClose, onSubmit } =
    props;
  const hasValue = value.trim().length > 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={() => {
        /* no-op */
      }}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        zIndex={9999}
      >
        <Dialog.Content
          css={{
            background: UI_TOKENS.COLORS.panelBg,
            border: `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
            borderRadius: 0,
            boxShadow: UI_TOKENS.SHADOWS.panelDistinct,
            maxWidth: "480px",
            width: "90vw",
          }}
        >
          <Box
            p={5}
            css={{
              borderBottom: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            }}
          >
            <Dialog.Title>
              <Text
                fontSize="lg"
                fontWeight="bold"
                color="white"
                fontFamily="monospace"
              >
                お題を入力
              </Text>
            </Dialog.Title>
          </Box>
          <Dialog.Body p={6}>
            <VStack align="stretch" gap={4}>
              <Input
                placeholder="れい：この夏さいだいのなぞ"
                value={value}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  onChange(event.target.value)
                }
                onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === KEYBOARD_KEYS.ENTER) {
                    event.preventDefault();
                    if (value.trim()) onSubmit(value);
                  }
                }}
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
                    boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                    background: "#f8f8f8",
                    outline: "none",
                  },
                  _hover: {
                    background: "#f8f8f8",
                  },
                }}
              />
              <HStack justify="space-between" gap={3}>
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
                    transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.color =
                      "var(--colors-richBlack-800)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "white";
                  }}
                >
                  やめる
                </button>
                <button
                  onClick={() => {
                    if (interactionDisabled) return;
                    if (value.trim()) onSubmit(value);
                  }}
                  disabled={!hasValue || interactionDisabled}
                  style={{
                    minWidth: "140px",
                    height: "40px",
                    borderRadius: 0,
                    fontWeight: "bold",
                    fontSize: "1rem",
                    fontFamily: "monospace",
                    border: "borders.retrogameThin",
                    background:
                      !hasValue || interactionDisabled
                        ? "#666"
                        : "var(--colors-richBlack-600)",
                    color: "white",
                    cursor:
                      !hasValue || interactionDisabled ? "not-allowed" : "pointer",
                    textShadow: "1px 1px 0px #000",
                    transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                    opacity: !hasValue || interactionDisabled ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (value.trim() && !interactionDisabled) {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.color =
                        "var(--colors-richBlack-800)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (value.trim() && !interactionDisabled) {
                      e.currentTarget.style.background =
                        "var(--colors-richBlack-600)";
                      e.currentTarget.style.color = "white";
                    }
                  }}
                >
                  きめる
                </button>
              </HStack>
            </VStack>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

