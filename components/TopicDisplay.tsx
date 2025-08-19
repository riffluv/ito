"use client";
import { Button, HStack, Stack, Text, useToast } from "@chakra-ui/react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { RoomDoc } from "@/lib/types";
import { Panel } from "@/components/ui/Panel";
import { dealNumbers } from "@/lib/game/room";

export function TopicDisplay({ roomId, room, isHost }: { roomId: string; room: RoomDoc & { id?: string }; isHost: boolean }) {
  const toast = useToast();
  const hasTopic = !!room.topic;
  const opts = room.topicOptions || [];

  const choose = async (t: string) => {
    if (!isHost) return;
    await updateDoc(doc(db, "rooms", roomId), { topic: t });
    // お題選択後に配札（ユニーク配布）
    try {
      await dealNumbers(roomId);
    } catch (e: any) {
      toast({ title: "数字の配布に失敗", description: e?.message || String(e), status: "error" });
    }
  };

  return (
    <Panel title="お題">
      {hasTopic ? (
        <Stack>
          <HStack justify="space-between">
            <Text fontWeight="bold" fontSize="lg">{room.topic}</Text>
            {isHost && (
              <Button size="sm" onClick={async () => { try { await dealNumbers(roomId); toast({ title: "数字を配りました", status: "success" }); } catch (e: any) { toast({ title: "数字の配布に失敗", description: e?.message || String(e), status: "error" }); } }} isDisabled={!isHost}>
                数字を配る
              </Button>
            )}
          </HStack>
          {!room.deal && (
            <Text color="orange.300" fontSize="sm">数字が未配布です。ホストが「数字を配る」を押してください。</Text>
          )}
        </Stack>
      ) : (
        <Stack>
          <Text color="gray.300">{isHost ? "お題を選択してください（ホストのみ）" : "ホストがお題を選ぶまでお待ちください"}</Text>
          <HStack>
            {opts.map((t) => (
              <Button key={t} onClick={() => choose(t)} isDisabled={!isHost} variant={isHost ? "solid" : "outline"}>
                {t}
              </Button>
            ))}
          </HStack>
        </Stack>
      )}
    </Panel>
  );
}
