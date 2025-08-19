"use client";
import { useEffect, useRef, useState } from "react";
import { Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ChatDoc } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { Panel } from "@/components/ui/Panel";
import { sendMessage } from "@/lib/firebase/chat";

export function ChatPanel({ roomId, height = 360 }: { roomId: string; height?: number | string }) {
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
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
    });
    return () => unsub();
  }, [roomId]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    await sendMessage(roomId, displayName || "匿名", t);
    setText("");
  };

  return (
    <Panel p={2} h={height} display="flex" flexDir="column">
      <Box flex="1" overflowY="auto" p={2}>
        <Stack spacing={1}>
          {messages.map((m) => (
            <HStack key={m.id} align="flex-start">
              <Text fontWeight="bold" color="blue.300">{m.sender}</Text>
              <Text>{m.text}</Text>
            </HStack>
          ))}
        </Stack>
        <div ref={bottomRef} />
      </Box>
      <HStack>
        <Input
          placeholder="メッセージを入力"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
        />
        <Button onClick={send} colorScheme="blue">送信</Button>
      </HStack>
    </Panel>
  );
}
