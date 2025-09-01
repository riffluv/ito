"use client";
import { AppButton } from "@/components/ui/AppButton";
import ScrollableArea from "@/components/ui/ScrollableArea";
import { useAuth } from "@/context/AuthContext";
import { sendMessage } from "@/lib/firebase/chat";
import { db } from "@/lib/firebase/client";
import type { ChatDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Badge, Box, HStack, Input, Stack, Text } from "@chakra-ui/react";
import {
  collection,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";

/**
 * 改良されたChatPanel
 *
 * 改善点:
 * - 明確な高さ制御
 * - 予測可能なスクロール動作
 * - 適切なメッセージエリアとフォームの分離
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

  useEffect(() => {
    const q = query(
      collection(db!, "rooms", roomId, "chat"),
      orderBy("createdAt", "asc"),
      limitToLast(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: (ChatDoc & { id: string })[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as ChatDoc) }));
      setMessages(list);
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        0
      );
    });
    return () => unsub();
  }, [roomId]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    if (readOnly) return;
    const now = Date.now();
    if (now - lastSentAt.current < 600) return; // ローカルクールダウン
    lastSentAt.current = now;
    const clipped = t.slice(0, 500);
    if (!user?.uid) return;
    await sendMessage(roomId, user.uid, displayName || "匿名", clipped);
    setText("");
  };

  return (
    <Box h="100%" display="grid" gridTemplateRows="1fr auto" overflow="hidden">
      {/* メッセージエリア: 1fr 行で安定スクロール */}
      <Box overflow="hidden">
        <ScrollableArea
          label="チャットメッセージ"
          withPadding={true}
          padding={3}
        >
          <Stack gap={3}>
            {messages.map((m) => {
              const isSystem = m.sender === "system";
              const isMe = m.sender === (displayName || "匿名");
              return (
                <Box
                  key={m.id}
                  display="flex"
                  justifyContent={
                    isSystem ? "center" : isMe ? "flex-end" : "flex-start"
                  }
                >
                  <Box maxW="85%">
                    {isSystem ? (
                      <HStack opacity={0.8} justify="center">
                        <Badge variant="subtle" colorPalette="gray" size="xs">
                          system
                        </Badge>
                        <Text fontSize="sm" color="fgMuted">
                          {m.text}
                        </Text>
                      </HStack>
                    ) : (
                      <Stack gap={1} align={isMe ? "flex-end" : "flex-start"}>
                        <Text fontSize="xs" color="fgMuted">
                          {m.sender}
                        </Text>
                        <Box
                          px={3}
                          py={2}
                          borderRadius="xl"
                          bg={isMe ? "accentSubtle" : "panelSubBg"}
                          boxShadow={UNIFIED_LAYOUT.ELEVATION.CARD.RAISED}
                        >
                          <Text fontSize="sm">{m.text}</Text>
                        </Box>
                      </Stack>
                    )}
                  </Box>
                </Box>
              );
            })}
            <div ref={bottomRef} />
          </Stack>
        </ScrollableArea>
      </Box>

      {/* 入力フォーム: 固定行 */}
      <Box p={4} bg="gray.800" borderTop="1px solid" borderColor="gray.700">
        <HStack gap={3}>
          <Input
            placeholder={
              readOnly ? "観戦中は投稿できません" : "メッセージを入力..."
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            disabled={readOnly}
            size="md"
            borderRadius="xl"
            bg="gray.900"
            color="white"
            border="1px solid"
            borderColor="gray.600"
            _placeholder={{ color: "gray.400" }}
            _focus={{ 
              borderColor: "blue.400", 
              boxShadow: "0 0 0 1px rgba(96, 165, 250, 0.3)" 
            }}
            _hover={{ borderColor: "gray.500" }}
            transition="all 0.2s"
            px={4}
            py={3}
          />
          <AppButton
            onClick={send}
            disabled={readOnly || !text.trim()}
            size="md"
            bg="blue.600"
            color="white"
            borderRadius="xl"
            px={6}
            py={3}
            fontWeight="500"
            _hover={{ bg: "blue.500" }}
            _active={{ bg: "blue.700" }}
            _disabled={{ 
              bg: "gray.700", 
              color: "gray.400",
              cursor: "not-allowed"
            }}
            transition="all 0.2s"
          >
            送信
          </AppButton>
        </HStack>
      </Box>
    </Box>
  );
}

export default ChatPanel;
