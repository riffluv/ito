"use client";

import { MODAL_FOOTER_PADDING } from "@/components/create-room-modal/constants";
import { UI_TOKENS } from "@/theme/layout";
import { Box, HStack } from "@chakra-ui/react";

export function CreateRoomModalFooter(params: {
  isSuccess: boolean;
  canSubmit: boolean;
  submitting: boolean;
  onReset: () => void;
  onClose: () => void;
  onEnterRoom: () => void;
  onCreate: () => void;
}) {
  const { isSuccess, canSubmit, submitting, onReset, onClose, onEnterRoom, onCreate } = params;

  return (
    <Box
      p={MODAL_FOOTER_PADDING}
      pt={0}
      position="relative"
      zIndex={20}
      css={{
        borderTop: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
      }}
    >
      {isSuccess ? (
        <HStack justify="space-between" gap={3} mt={4}>
          <button
            onClick={onReset}
            style={{
              minWidth: "140px",
              height: "40px",
              borderRadius: 0,
              fontWeight: "bold",
              fontSize: "1rem",
              fontFamily: "monospace",
              border: "borders.retrogameThin",
              background: "transparent",
              color: "white",
              cursor: "pointer",
              textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
              transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "white";
              e.currentTarget.style.color = "black";
              e.currentTarget.style.textShadow = "none";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "white";
              e.currentTarget.style.textShadow = UI_TOKENS.TEXT_SHADOWS.soft;
            }}
          >
            もどる
          </button>
          <HStack gap={3}>
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
                textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.color = "black";
                e.currentTarget.style.textShadow = "none";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "white";
                e.currentTarget.style.textShadow = UI_TOKENS.TEXT_SHADOWS.soft;
              }}
            >
              とじる
            </button>
            <button
              onClick={onEnterRoom}
              style={{
                minWidth: "160px",
                height: "40px",
                borderRadius: 0,
                fontWeight: "bold",
                fontSize: "1rem",
                fontFamily: "monospace",
                border: "borders.retrogameThin",
                background: "var(--colors-richBlack-600)",
                color: "white",
                cursor: "pointer",
                textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.color = "black";
                e.currentTarget.style.textShadow = "none";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--colors-richBlack-600)";
                e.currentTarget.style.color = "white";
                e.currentTarget.style.textShadow = UI_TOKENS.TEXT_SHADOWS.soft;
              }}
            >
              へやへ すすむ
            </button>
          </HStack>
        </HStack>
      ) : (
        <HStack justify="space-between" gap={3} mt={4}>
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
              textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
              transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "white";
              e.currentTarget.style.color = "black";
              e.currentTarget.style.textShadow = "none";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "white";
              e.currentTarget.style.textShadow = UI_TOKENS.TEXT_SHADOWS.soft;
            }}
          >
            やめる
          </button>

          <button
            onClick={onCreate}
            disabled={!canSubmit}
            style={{
              minWidth: "140px",
              height: "40px",
              borderRadius: 0,
              fontWeight: "bold",
              fontSize: "1rem",
              fontFamily: "monospace",
              border: "borders.retrogameThin",
              background: !canSubmit ? "#666" : "var(--colors-richBlack-600)",
              color: "white",
              cursor: !canSubmit ? "not-allowed" : "pointer",
              textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
              transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
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
                e.currentTarget.style.background = "var(--colors-richBlack-600)";
                e.currentTarget.style.color = "white";
                e.currentTarget.style.textShadow = UI_TOKENS.TEXT_SHADOWS.soft;
              }
            }}
          >
            {submitting ? "さくせい中..." : "作成"}
          </button>
        </HStack>
      )}
    </Box>
  );
}

