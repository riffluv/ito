"use client";
import { Panel } from "@/components/ui/Panel";
import { toaster } from "@/components/ui/toaster";
import { updateClue1 } from "@/lib/firebase/players";
import type { PlayerDoc } from "@/lib/types";
import { Button, Heading, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

export function CluePanel({
  roomId,
  me,
  label = "連想ワード",
  readOnly = false,
}: {
  roomId: string;
  me: PlayerDoc & { id: string };
  label?: string;
  readOnly?: boolean;
}) {
  const [text, setText] = useState<string>(me?.clue1 || "");
  useEffect(() => setText(me?.clue1 || ""), [me?.clue1]);

  const submit = async () => {
    const value = text.trim();
    if (!value) {
      toaster.create({ title: `${label}を入力してください`, type: "warning" });
      return;
    }
    if (readOnly) return;
    await updateClue1(roomId, me.id, value);
    toaster.create({ title: `${label}を更新しました`, type: "success" });
  };

  return (
    <Panel title={label}>
      <Stack gap={3}>
        <div
          style={
            {
              padding: 12,
              borderWidth: 1,
              borderRadius: 8,
              background: "var(--chakra-colors-panelSubBg)",
            } as any
          }
        >
          <Text fontSize="sm" color="gray.300">
            あなたの数字（自分にだけ表示）
          </Text>
          <Heading size="lg" color="yellow.300">
            {me.number ?? "?"}
          </Heading>
        </div>
        <HStack>
          <Input
            placeholder={`${label}（いつでも変更可）`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            disabled={readOnly}
          />
          <Button onClick={submit} colorPalette="orange" disabled={readOnly}>
            更新
          </Button>
        </HStack>
        <Text color="gray.300">
          {label}
          は全員に表示されます。チャットで相談しながら自由に変更できます。
        </Text>
      </Stack>
    </Panel>
  );
}
