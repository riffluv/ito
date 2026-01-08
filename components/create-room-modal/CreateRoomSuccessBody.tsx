"use client";

import { MODAL_BODY_PADDING } from "@/components/create-room-modal/constants";
import { UI_TOKENS } from "@/theme/layout";
import { Box, Text, VStack } from "@chakra-ui/react";

export function CreateRoomSuccessBody({
  inviteUrl,
  inviteCopied,
  onCopyInvite,
}: {
  inviteUrl: string;
  inviteCopied: boolean;
  onCopyInvite: () => void;
}) {
  return (
    <Box p={MODAL_BODY_PADDING} position="relative" zIndex={20}>
      <VStack gap={4} align="stretch">
        <Text
          fontSize="sm"
          color="rgba(255,255,255,0.85)"
          fontFamily="monospace"
          textAlign="center"
          textShadow="0 1px 2px rgba(0,0,0,0.6)"
        >
          このリンクを おくって なかまを よぼう！
        </Text>

        <Box
          p={3}
          bg="rgba(8,9,15,0.6)"
          border="2px solid rgba(255,255,255,0.3)"
          borderRadius={0}
        >
          <Text
            fontSize="sm"
            color="rgba(255,255,255,0.95)"
            fontFamily="monospace"
            wordBreak="break-all"
            lineHeight="1.6"
            textAlign="center"
          >
            {inviteUrl}
          </Text>
        </Box>

        <button
          type="button"
          onClick={onCopyInvite}
          style={{
            width: "100%",
            height: "48px",
            borderRadius: "3px", // 角丸追加
            border: `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
            background: inviteCopied ? "white" : "transparent",
            color: inviteCopied ? "black" : "white",
            fontFamily: "monospace",
            fontWeight: "bold",
            fontSize: "17px", // 奇数サイズ
            letterSpacing: "0.02em", // 字間追加
            padding: "0 17px", // 奇数パディング
            cursor: "pointer",
            textShadow: inviteCopied ? "none" : "0 2px 4px rgba(0,0,0,0.8)",
            transition: "all 180ms cubic-bezier(.2,1,.3,1)", // 手癖カーブ
            boxShadow: "2px 3px 0 rgba(0,0,0,0.72)", // 微妙にずらす
            transform: "translate(.5px,-.5px)", // 初期位置微調整
            outline: "none",
          }}
          onMouseEnter={(event) => {
            if (!inviteCopied) {
              event.currentTarget.style.background = "white";
              event.currentTarget.style.color = "black";
              event.currentTarget.style.transform = "translate(0,-1px)"; // 浮き上がり
              event.currentTarget.style.boxShadow = "3px 4px 0 rgba(0,0,0,0.72)";
            }
          }}
          onMouseLeave={(event) => {
            if (!inviteCopied) {
              event.currentTarget.style.background = "transparent";
              event.currentTarget.style.color = "white";
              event.currentTarget.style.transform = "translate(.5px,-.5px)"; // 元の位置
              event.currentTarget.style.boxShadow = "2px 3px 0 rgba(0,0,0,0.72)";
            }
          }}
          onMouseDown={(event) => {
            event.currentTarget.style.transform = "translate(0,0)"; // 押し込み
            event.currentTarget.style.boxShadow = "1px 2px 0 rgba(0,0,0,0.85)";
          }}
          onMouseUp={(event) => {
            event.currentTarget.style.transform = inviteCopied
              ? "translate(0,0)"
              : "translate(0,-1px)";
            event.currentTarget.style.boxShadow = "3px 4px 0 rgba(0,0,0,0.72)";
          }}
        >
          {inviteCopied ? "✓ コピーしました！" : "◆ リンクを コピー"}
        </button>
      </VStack>
    </Box>
  );
}

