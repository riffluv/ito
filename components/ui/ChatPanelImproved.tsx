"use client";
import { AppButton } from "@/components/ui/AppButton";
import ScrollableArea from "@/components/ui/ScrollableArea";
import { useAuth } from "@/context/AuthContext";
import { sendMessage } from "@/lib/firebase/chat";
import { db } from "@/lib/firebase/client";
import type { ChatDoc } from "@/lib/types";
import { notify } from "@/components/ui/notify";
import { validateChatMessage } from "@/lib/validation/forms";
import { Box, HStack, Input, Stack } from "@chakra-ui/react";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerDoc } from "@/lib/types";

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
  players?: (PlayerDoc & { id: string })[];
  hostId?: string | null;
  readOnly?: boolean;
}

const PLAYER_ACCENT_COLORS = [
  UI_TOKENS.COLORS.dqBlue,
  UI_TOKENS.COLORS.limeGreen,
  UI_TOKENS.COLORS.violet,
  UI_TOKENS.COLORS.orangeRed,
  UI_TOKENS.COLORS.dqPurple,
  UI_TOKENS.COLORS.skyBlue,
];

type PlayerChatMeta = {
  name: string;
  avatar?: string | null;
  accentColor: string;
};

export function ChatPanel({
  roomId,
  players = [],
  hostId = null,
  readOnly = false,
}: ChatPanelProps) {
  const { user, displayName } = useAuth() as any;
  const [messages, setMessages] = useState<(ChatDoc & { id: string })[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lastSentAt = useRef<number>(0);
  // 右上トースト（eventsコレクション）重複防止用
  const lastEventSeenRef = useRef<string | null>(null);
  const initializedEventsRef = useRef(false);
  const lastSystemMessageRef = useRef<string | null>(null);
  const initializedSystemRef = useRef(false);

  // 自動スクロール制御
  const autoScrollRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const pendingScrollFrameRef = useRef<number | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    if (pendingScrollFrameRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(pendingScrollFrameRef.current);
      pendingScrollFrameRef.current = null;
    }

    if (typeof window === "undefined") {
      scrollArea.scrollTop = scrollArea.scrollHeight;
      autoScrollRef.current = true;
      return;
    }

    pendingScrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior });
      pendingScrollFrameRef.current = null;
      autoScrollRef.current = true;
    });
  }, []);

  const handleScroll = useCallback(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    const distanceFromBottom = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight;
    autoScrollRef.current = distanceFromBottom <= 120;
  }, []);

  useEffect(() => {
    return () => {
      if (pendingScrollFrameRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(pendingScrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const current = messages.length;
    const previous = lastMessageCountRef.current;
    const hasNewMessages = current > previous;
    const isInitialLoad = previous === 0 && current > 0;
    lastMessageCountRef.current = current;

    if (current === 0) return;

    if (isInitialLoad) {
      scrollToBottom("auto");
      return;
    }

    if (hasNewMessages && autoScrollRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages.length, scrollToBottom]);

  const playerMeta = useMemo(() => {
    const meta = new Map<string, PlayerChatMeta>();
    players.forEach((player, index) => {
      const accent = PLAYER_ACCENT_COLORS[index % PLAYER_ACCENT_COLORS.length];
      meta.set(player.id, {
        name: player.name,
        avatar: player.avatar ?? null,
        accentColor: accent,
      });
    });
    return meta;
  }, [players]);

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

  // 通知は RoomNotifyBridge 側で購読・表示するため、
  // チャット側では購読しない（重複トースト防止）。


  // 互換目的の描画ガードのみ維持（notify| はチャットに描画しない）。
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
      maxH="300px"
      w="100%"
      maxW="400px"
      display="grid"
      gridTemplateRows="minmax(0,1fr) auto"
      overflow="hidden"
      minH={0}
      // ドラクエ風統一デザイン
      bg="rgba(8,9,15,0.95)"
      border="3px solid rgba(255,255,255,0.9)"
      borderRadius={0}
      boxShadow="0 8px 32px rgba(0,0,0,0.8), inset 0 1px 2px rgba(255,255,255,0.1)"
      position="relative"
      _before={{
        content: '""',
        position: "absolute",
        top: "-3px",
        left: "-3px",
        right: "-3px",
        bottom: "-3px",
        bg: "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))",
        borderRadius: 0,
        zIndex: -1,
      }}
    >
      {/* メッセージエリア: 1fr行で安定スクロール、ドラクエ風一行チャット */}
      <Box overflow="hidden" minH={0}>
        <ScrollableArea
          label="チャットメッセージ"
          withPadding={true}
          padding={0}
          ref={scrollAreaRef}
          onScroll={handleScroll}
        >
          <Stack
            gap={1}
            px={2}
            py={2}
            css={{
              "@layer dpi-responsive": {
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                  gap: "0.2rem",
                  padding: "0.3rem 0.4rem",
                },
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
                  gap: "0.1rem",
                  padding: "0.2rem 0.3rem",
                },
              }
            }}
          >
            {messages.map((m) => {
              const isSystem = m.sender === "system";
              const uid = typeof m.uid === "string" ? m.uid : "";

              if (isSystem) {
                const textValue = typeof m.text === "string" ? m.text : "";
                if (textValue.startsWith("notify|")) return null;
                return (
                  <Box
                    key={m.id}
                    px={3}
                    py={2}
                    border={`2px dashed ${UI_TOKENS.COLORS.whiteAlpha40}`}
                    borderRadius={0}
                    bg="rgba(12,14,22,0.75)"
                    color={UI_TOKENS.COLORS.whiteAlpha80}
                    fontFamily="monospace"
                    fontSize="xs"
                    textAlign="center"
                    textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
                  >
                    {textValue}
                  </Box>
                );
              }

              const meta = playerMeta.get(uid);
              const senderName = meta?.name || m.sender || "Unknown";
              const isMe = uid && user?.uid ? uid === user.uid : senderName === (displayName || "匿名");
              const isHost = hostId ? uid === hostId : false;

              return (
                <ChatMessageRow
                  key={m.id}
                  sender={senderName}
                  text={m.text || ""}
                  isMe={isMe}
                  isHost={isHost}
                  avatar={meta?.avatar}
                  accentColor={meta?.accentColor}
                />
              );
            })}
            <div ref={bottomRef} />
          </Stack>
        </ScrollableArea>
      </Box>

      {/* 入力フォーム: ドラクエ風コンパクトデザイン */}
      <Box
        p={2}
        bg="rgba(8,9,15,0.98)"
        borderTop="2px solid rgba(255,255,255,0.3)"
        css={{
          "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)": {
            padding: "0.4rem !important",
          },
          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)": {
            padding: "0.3rem !important",
          },
        }}
      >
        <HStack
          gap={2}
          css={{
            "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)": {
              gap: "0.3rem !important",
            },
            "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)": {
              gap: "0.2rem !important",
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
            size="sm"
            bg="rgba(12,14,24,0.9)"
            color="white"
            border="2px solid rgba(255,255,255,0.6)"
            borderRadius={0} // 完全角ばったドラクエ風
            boxShadow="inset 0 2px 4px rgba(0,0,0,0.3)"
            fontFamily="monospace"
            fontSize="sm"
            _placeholder={{
              color: "rgba(255,255,255,0.4)",
              fontFamily: "monospace"
            }}
            _focus={{
              borderColor: UI_TOKENS.COLORS.dqBlue,
              boxShadow: `0 0 8px ${UI_TOKENS.COLORS.dqBlue}`,
              bg: "rgba(12,14,24,0.95)",
            }}
            _hover={{
              borderColor: "rgba(255,255,255,0.8)",
              bg: "rgba(12,14,24,0.95)",
            }}
            transition="all 0.15s ease"
            px={2}
            py={1}
            css={{
              "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)": {
                fontSize: "0.7rem !important",
                padding: "0.2rem 0.4rem !important",
              },
              "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)": {
                fontSize: "0.65rem !important",
                padding: "0.15rem 0.3rem !important",
              },
            }}
          />
          <AppButton
            onClick={send}
            disabled={readOnly || !text.trim()}
            size="sm"
            bg="rgba(12,14,24,0.9)"
            color="white"
            border="2px solid rgba(255,255,255,0.9)"
            borderRadius={0}
            px={3}
            py={1}
            fontWeight="700"
            fontFamily="monospace"
            fontSize="sm"
            textShadow="0 1px 2px rgba(0,0,0,0.8)"
            minW="50px"
            css={{
              "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)": {
                fontSize: "0.7rem !important",
                padding: "0.2rem 0.6rem !important",
                minWidth: "40px !important",
              },
              "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)": {
                fontSize: "0.65rem !important",
                padding: "0.15rem 0.5rem !important",
                minWidth: "35px !important",
              },
            }}
            boxShadow="0 2px 8px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.2)"
            _hover={{
              bg: "white",
              color: "rgba(8,9,15,0.95)",
              textShadow: "none",
              borderColor: "white",
            }}
            _active={{
              bg: "rgba(255,255,255,0.9)",
              color: "rgba(8,9,15,0.95)",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)",
              transform: "translateY(1px)",
            }}
            _disabled={{
              bg: "rgba(60,60,60,0.5)",
              color: "rgba(255,255,255,0.3)",
              cursor: "not-allowed",
              borderColor: "rgba(255,255,255,0.3)",
            }}
            transition="all 0.15s ease"
          >
            送信
          </AppButton>
        </HStack>
      </Box>
    </Box>
  );
}

export default ChatPanel;
