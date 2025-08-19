"use client";
import { Button, HStack, Input, Stack, Text, useToast, Heading } from "@chakra-ui/react";
import { updateClue1 } from "@/lib/firebase/players";
import type { PlayerDoc } from "@/lib/types";
import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/Panel";

export function CluePanel({ roomId, me, label = "連想ワード" }: { roomId: string; me: (PlayerDoc & { id: string }); label?: string }) {
  const toast = useToast();
  const [text, setText] = useState<string>(me?.clue1 || "");
  useEffect(() => setText(me?.clue1 || ""), [me?.clue1]);

  const submit = async () => {
    const value = text.trim();
    if (!value) {
      toast({ title: `${label}を入力してください`, status: "warning" });
      return;
    }
    await updateClue1(roomId, me.id, value);
    toast({ title: `${label}を更新しました`, status: "success" });
  };

  return (
    <Panel title={label}>
      <Stack spacing={3}>
        <div style={{ padding: 12, borderWidth: 1, borderRadius: 8, background: "var(--chakra-colors-panelSubBg)" } as any}>
          <Text fontSize="sm" color="gray.300">あなたの数字（自分にだけ表示）</Text>
          <Heading size="lg" color="yellow.300">{me.number ?? "?"}</Heading>
        </div>
        <HStack>
          <Input
            placeholder={`${label}（いつでも変更可）`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          />
          <Button onClick={submit} colorScheme="blue">更新</Button>
        </HStack>
        <Text color="gray.300">{label}は全員に表示されます。チャットで相談しながら自由に変更できます。</Text>
      </Stack>
    </Panel>
  );
}
