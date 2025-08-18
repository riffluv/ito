"use client";
import { useEffect, useRef, useState } from "react";
import { Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ChatDoc } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

export function ChatPanel({ roomId }: { roomId: string }) {
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
    await addDoc(collection(db, "rooms", roomId, "chat"), {
      sender: displayName || "匿名",
      text: t,
      createdAt: serverTimestamp(),
    });
    setText("");
  };

  return (
    <Box borderWidth="1px" rounded="lg" p={2} bg="blackAlpha.300" h="100%" display="flex" flexDir="column">
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
    </Box>
  );
}
