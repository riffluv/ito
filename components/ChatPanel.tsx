"use client";
import { Panel } from "@/components/ui/Panel";
import { useAuth } from "@/context/AuthContext";
import { sendMessage } from "@/lib/firebase/chat";
import { db } from "@/lib/firebase/client";
import type { ChatDoc } from "@/lib/types";
import { Badge, Box, HStack, Input, ScrollArea, Stack, Text } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";
import { collection, limitToLast, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";

export function ChatPanel({
  roomId,
  height = 360,
  readOnly = false,
}: {
  roomId: string;
  height?: number | string;
  readOnly?: boolean;
}) {
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
    <Panel p={2} h={height} display="flex" flexDir="column">
      <ScrollArea.Root style={{ flex: 1 }}>
        <ScrollArea.Viewport>
          <ScrollArea.Content>
            <Box p={2}>
              {/* 履歴は最新100件のみ表示（ページングは行わない方針） */}
              <Stack gap={2}>
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
                <Box maxW="82%">
                  {isSystem ? (
                    <HStack opacity={0.9} justify="center">
                      <Badge variant="subtle" colorPalette="gray">
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
                        borderWidth="1px"
                        borderColor="borderDefault"
                      >
                        <Text>{m.text}</Text>
                      </Box>
                    </Stack>
                  )}
                </Box>
              </Box>
            );
          })}
              </Stack>
              <div ref={bottomRef} />
            </Box>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
        <ScrollArea.Corner />
      </ScrollArea.Root>
      <HStack>
        <Input
          placeholder={readOnly ? "観戦中は投稿できません" : "メッセージを入力"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          disabled={readOnly}
        />
        <AppButton onClick={send} colorPalette="orange" disabled={readOnly}>
          送信
        </AppButton>
      </HStack>
    </Panel>
  );
}
