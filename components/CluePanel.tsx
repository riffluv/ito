"use client";
import { Panel } from "@/components/ui/Panel";
import { notify } from "@/components/ui/notify";
import { updateClue1 } from "@/lib/firebase/players";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import {
  Box,
  Button,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
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
      notify({ title: `${label}を入力してください`, type: "warning" });
      return;
    }
    if (readOnly) return;
    await updateClue1(roomId, me.id, value);
    notify({ title: `${label}を更新しました`, type: "success" });
  };

  return (
    <Panel title={label}>
      <Stack gap={3}>
        <Box
          p={3}
          borderRadius="md"
          bg="panelSubBg"
          userSelect="none"
          draggable={true}
          boxShadow={UNIFIED_LAYOUT.ELEVATION.GAME.HAND_CARD}
          cursor="move"
          onDragStart={(e: React.DragEvent) => {
            try {
              e.dataTransfer.setData("text/plain", me.id);
              e.dataTransfer.effectAllowed = "move";
              // try to set drag image to the element itself for visual feedback
              try {
                const el = e.currentTarget as Element;
                // offset center
                (e.dataTransfer as any).setDragImage(el, 40, 40);
              } catch {}
              // visual: reduce opacity
              try {
                (e.currentTarget as HTMLElement).style.opacity = "0.6";
              } catch {}
            } catch {}
          }}
          onDragEnd={(e: React.DragEvent) => {
            try {
              (e.currentTarget as HTMLElement).style.opacity = "1";
            } catch {}
          }}
        >
          <Text fontSize="sm" color="gray.300">
            あなたの数字（自分にだけ表示）
          </Text>
          <Heading size="lg" color="yellow.300">
            {me.number ?? "?"}
          </Heading>
        </Box>
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
