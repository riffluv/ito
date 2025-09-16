"use client";
import { AppButton } from "@/components/ui/AppButton";
import ScrollableArea from "@/components/ui/ScrollableArea";
import { useAuth } from "@/context/AuthContext";
import { sendMessage } from "@/lib/firebase/chat";
import { db } from "@/lib/firebase/client";
import type { ChatDoc } from "@/lib/types";
import { notify } from "@/components/ui/notify";
import { validateChatMessage } from "@/lib/validation/forms";
import { Badge, Box, HStack, Input, Stack, Text } from "@chakra-ui/react";
import ChatMessageRow from "@/components/ui/ChatMessageRow";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
import {
  collection,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
import { useEffect, useRef, useState } from "react";

/**
 * ドラクエ風チャットパネル (改良版)
 *
 * 特徴:
 * - ドラクエ風デザイン統一 (リッチブラック、白枠、角ばったデザイン)
 * - CSS ellipsisによる名前の自動省略でコロン位置完全統一
 * - monospaceフォント + textShadowでレトロゲーム感
 * - 名前部分は100px固定幅、メッセージは100文字制限
 * - ホバーでフルネーム表示、8文字でトランケート
 *
 * 改善履歴:
 * - 2025-09: 吹き出し削除 → シンプル一行形式
 * - 2025-09: 手動省略 → CSS ellipsis (ベストプラクティス)
 * - 2025-09: right-align → left-align (コロン位置統一)
 */
export interface ChatPanelProps {
  roomId: string;
  readOnly?: boolean;
}

export function ChatPanel({ roomId, readOnly = false }: ChatPanelProps) {
  const { user, displayName } = useAuth() as any;
  const [messages, setMessages] = useState<(ChatDoc & { id: string })[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSentAt = useRef<number>(0);

  // 時刻表示は不要のため削除（UI簡素化）

  useEffect(() => {
    const q = query(
      collection(db!, "rooms", roomId, "chat"),
      orderBy("createdAt", "asc"),
      limitToLast(100)
    );

    const unsubRef = { current: null as null | (() => void) };
    const backoffUntilRef = { current: 0 };
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      try { unsubRef.current?.(); } catch {}
      unsubRef.current = null;
    };

    const maybeStart = () => {
      if (unsubRef.current) return;
      const now = Date.now();
      if (now < backoffUntilRef.current) return;
      unsubRef.current = onSnapshot(
        q,
        (snap) => {
          const list: (ChatDoc & { id: string })[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...(d.data() as ChatDoc) }));
          setMessages(list);
          setTimeout(
            () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
            0
          );
        },
        (err) => {
          if (isFirebaseQuotaExceeded(err)) {
            handleFirebaseQuotaError("チャット購読");
            backoffUntilRef.current = Date.now() + 5 * 60 * 1000;
            stop();
            if (backoffTimer) {
              try { clearTimeout(backoffTimer); } catch {}
              backoffTimer = null;
            }
            const resume = () => {
              if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
              const remain = backoffUntilRef.current - Date.now();
              if (remain > 0) backoffTimer = setTimeout(resume, Math.min(remain, 30_000));
              else maybeStart();
            };
            resume();
          }
        }
      );
    };

    if (typeof document === "undefined" || document.visibilityState === "visible") {
      maybeStart();
    }
    const onVis = () => {
      if (document.visibilityState === "visible") maybeStart();
      else stop();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
      if (backoffTimer) {
        try { clearTimeout(backoffTimer); } catch {}
      }
      stop();
    };
  }, [roomId]);

  const send = async () => {
    if (readOnly) return;
    let sanitized: string;
    try {
      sanitized = validateChatMessage(text);
    } catch (err: any) {
      notify({
        title: "メッセージを確認してください",
        description: err?.errors?.[0]?.message,
        type: "warning",
      });
      return;
    }
    const now = Date.now();
    if (now - lastSentAt.current < 600) return;
    lastSentAt.current = now;
    const clipped = sanitized.slice(0, 100);
    if (!user?.uid) return;
    try {
      await sendMessage(roomId, user.uid, displayName || "匿名", clipped);
      setText("");
    } catch (err) {
      notify({
        title: "送信に失敗しました",
        description: (err as any)?.message,
        type: "error",
      });
    }
  };


  return (
    <Box
      h="100%"
      display="grid"
      gridTemplateRows="minmax(0,1fr) auto"
      overflow="hidden"
      minH={0}
      css={{}}
    >
      {/* メッセージエリア: 1fr行で安定スクロール、ドラクエ風一行チャット */}
      <Box overflow="hidden" minH={0}>
        <ScrollableArea
          label="チャットメッセージ"
          withPadding={true}
          padding={0}
        >
          <Stack
            gap={3}
            px={4}
            py={3}
            css={{
              "@layer dpi-responsive": {
                // DPI 125%対応：統一定数活用
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                  gap: UNIFIED_LAYOUT.DPI_125.SPACING?.FORM_GAP || "0.4rem",
                  padding: UNIFIED_LAYOUT.DPI_125.SPACING?.COMPONENT_PADDING || "0.5rem 0.8rem",
                },
                // DPI 150%対応：統一定数活用
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
                  gap: UNIFIED_LAYOUT.DPI_150.SPACING.FORM_GAP,
                  padding: UNIFIED_LAYOUT.DPI_150.SPACING.COMPONENT_PADDING,
                },
              }
            }}
          >
            {messages.map((m) => {
              const isSystem = m.sender === "system";
              const isMe = m.sender === (displayName || "匿名");
              return (
                <Box key={m.id}>
                  {isSystem ? (
                    <Box w="100%">
                      <Text
                        fontSize="xs"
                        color={UI_TOKENS.COLORS.whiteAlpha80}
                        fontFamily="monospace"
                        textAlign="center"
                        textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
                      >
                        {m.text}
                      </Text>
                    </Box>
                  ) : (
                    <ChatMessageRow sender={m.sender} text={m.text} isMe={isMe} />
                  )}
                </Box>
              );
            })}
            <div ref={bottomRef} />
          </Stack>
        </ScrollableArea>
      </Box>

      {/* 入力フォーム: 固定行、ドラクエ風統一デザイン */}
      <Box
        p={4}
        bg="gray.800"
        borderTop="1px solid"
        borderColor="gray.700"
        css={{
          // DPI 150%対応：入力エリアのコンパクト化
          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
            {
              padding: "0.6rem !important", // パディングを更に小さく
            },
        }}
      >
        <HStack 
          gap={3}
          css={{
            // DPI 125%以上：入力欄をコンパクト化
            "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
              {
                gap: "0.5rem !important", // ギャップを縮小
              },
          }}
        >
          <Input
            placeholder={
              readOnly ? "観戦中は投稿できません" : "メッセージを入力..."
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={100}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            disabled={readOnly}
            size="md"
            bg={UI_TOKENS.COLORS.panelBg}
            color="white"
            border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha60}`}
            borderRadius={6} // 軽く角ばったドラクエ風
            boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
            _placeholder={{ color: UI_TOKENS.COLORS.whiteAlpha50 }}
            _focus={{
              borderColor: UI_TOKENS.COLORS.dqBlue,
              boxShadow: UI_TOKENS.SHADOWS.panelDistinct,
              bg: UI_TOKENS.COLORS.panelBg,
            }}
            _hover={{
              borderColor: UI_TOKENS.COLORS.whiteAlpha80,
              bg: UI_TOKENS.COLORS.panelBg,
            }}
            transition={`border-color 0.15s ${UI_TOKENS.EASING.standard}, box-shadow 0.15s ${UI_TOKENS.EASING.standard}, background-color 0.15s ${UI_TOKENS.EASING.standard}`}
            px={4}
            py={3}
            css={{
              // DPI 125%以上：入力フィールドのコンパクト化
              "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
                {
                  fontSize: "0.8rem !important", // フォントサイズを小さく
                  padding: "0.4rem 0.7rem !important", // パディングを小さく
                },
              "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
                {
                  fontSize: "0.75rem !important", // さらに小さく
                  padding: "0.3rem 0.6rem !important", // より小さく
                },
            }}
          />
          <AppButton
            onClick={send}
            disabled={readOnly || !text.trim()}
            size="md"
            bg={UI_TOKENS.COLORS.panelBg}
            color="white"
            border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
            borderRadius={0} // 完全角ばったドラクエ風
            px={6}
            py={3}
            fontWeight="700"
            fontFamily="monospace" // ドラクエ風フォント統一
            textShadow={UI_TOKENS.TEXT_SHADOWS.soft as any}
            css={{
              // DPI 125%以上：送信ボタンのコンパクト化
              "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
                {
                  fontSize: "0.8rem !important", // フォントサイズを小さく
                  padding: "0.4rem 1rem !important", // パディングを小さく
                },
              "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
                {
                  fontSize: "0.75rem !important", // さらに小さく
                  padding: "0.3rem 0.8rem !important", // より小さく
                },
            }}
            boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
            _hover={{
              bg: "white", // ドラクエ王道の白背景反転
              color: UI_TOKENS.COLORS.panelBg,
              textShadow: "none",
            }}
            _active={{
              bg: UI_TOKENS.COLORS.whiteAlpha90,
              color: UI_TOKENS.COLORS.panelBg,
              boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
            }}
            _disabled={{
              bg: UI_TOKENS.COLORS.blackAlpha60,
              color: UI_TOKENS.COLORS.whiteAlpha40,
              cursor: "not-allowed",
              textShadow: UI_TOKENS.TEXT_SHADOWS.soft as any,
            }}
            transition={`background-color 0.15s ${UI_TOKENS.EASING.standard}, color 0.15s ${UI_TOKENS.EASING.standard}, box-shadow 0.15s ${UI_TOKENS.EASING.standard}, border-color 0.15s ${UI_TOKENS.EASING.standard}`}
          >
            送信
          </AppButton>
        </HStack>
      </Box>
    </Box>
  );
}

export default ChatPanel;
