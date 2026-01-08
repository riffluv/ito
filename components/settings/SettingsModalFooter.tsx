"use client";

import { UI_TOKENS } from "@/theme/layout";
import type { SettingsTab } from "@/components/settings/settingsModalModel";
import { Box, HStack } from "@chakra-ui/react";

export type SettingsModalFooterProps = {
  activeTab: SettingsTab;
  isHost: boolean;
  roomStatus: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void | Promise<void>;
};

export function SettingsModalFooter(props: SettingsModalFooterProps) {
  const { activeTab, isHost, roomStatus, saving, onClose, onSave } = props;

  return (
    <Box
      p={6}
      pt={4}
      position="relative"
      zIndex={20}
      css={{
        background: "transparent",
        borderTop: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
      }}
    >
      <HStack justify="space-between" gap={3}>
        <button
          onClick={onClose}
          style={{
            minWidth: "120px",
            height: "40px",
            borderRadius: "0",
            fontWeight: 880,
            fontSize: "1rem",
            fontFamily: "monospace",
            border: `2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
            background: "transparent",
            color: "white",
            cursor: "pointer",
            textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
            transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "white";
            e.currentTarget.style.color = UI_TOKENS.COLORS.panelBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "white";
          }}
        >
          戻る
        </button>

        {activeTab === "game" ? (
          <button
            onClick={onSave}
            disabled={saving || !isHost || roomStatus !== "waiting"}
            style={{
              minWidth: "140px",
              height: "40px",
              borderRadius: "0",
              fontWeight: 880,
              fontSize: "1rem",
              fontFamily: "monospace",
              border: `2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
              background:
                saving || !isHost || roomStatus !== "waiting"
                  ? "#666"
                  : UI_TOKENS.COLORS.panelBg,
              color: "white",
              cursor:
                saving || !isHost || roomStatus !== "waiting"
                  ? "not-allowed"
                  : "pointer",
              textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
              transition: `background-color 103ms cubic-bezier(.2,1,.3,1), color 103ms cubic-bezier(.2,1,.3,1), border-color 103ms cubic-bezier(.2,1,.3,1)`,
              opacity: saving || !isHost || roomStatus !== "waiting" ? 0.62 : 1,
            }}
            onMouseEnter={(e) => {
              if (!saving && isHost && roomStatus === "waiting") {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.color = UI_TOKENS.COLORS.panelBg;
              }
            }}
            onMouseLeave={(e) => {
              if (!saving && isHost && roomStatus === "waiting") {
                e.currentTarget.style.background = UI_TOKENS.COLORS.panelBg;
                e.currentTarget.style.color = "white";
              }
            }}
          >
            {saving ? "記録中..." : "記録"}
          </button>
        ) : (
          <Box
            px={4}
            py={2.5}
            borderWidth="2px"
            borderStyle="solid"
            borderColor={UI_TOKENS.COLORS.whiteAlpha60}
            bg={UI_TOKENS.COLORS.whiteAlpha10}
            color={UI_TOKENS.COLORS.whiteAlpha80}
            fontFamily="monospace"
            fontSize="0.9rem"
            minW="180px"
            textAlign="center"
            lineHeight="short"
          >
            選択した内容は
            <br />
            即座に記録されます
          </Box>
        )}
      </HStack>
    </Box>
  );
}

