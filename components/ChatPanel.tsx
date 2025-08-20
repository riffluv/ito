"use client";
import { Panel } from "@/components/ui/Panel";
import { useAuth } from "@/context/AuthContext";
import { sendMessage } from "@/lib/firebase/chat";
import { db } from "@/lib/firebase/client";
import type { ChatDoc } from "@/lib/types";
import {
  Badge,
  Box,
  Button,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
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
  const { displayName } = useAuth();
  const [messages, setMessages] = useState<(ChatDoc & { id: string })[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, "rooms", roomId, "chat"),
      orderBy("createdAt", "asc"),
      limit(200)
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
    await sendMessage(roomId, displayName || "匿名", t);
    setText("");
  };

  return (
    <Panel p={2} h={height} display="flex" flexDir="column">
      <Box flex="1" overflowY="auto" p={2}>
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
        <Button onClick={send} colorPalette="orange" disabled={readOnly}>
          送信
        </Button>
      </HStack>
    </Panel>
  );
}
