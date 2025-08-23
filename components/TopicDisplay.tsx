"use client";
import { Panel } from "@/components/ui/Panel";
import { notify } from "@/components/ui/notify";
import { db } from "@/lib/firebase/client";
import { dealNumbers } from "@/lib/game/room";
import {
  fetchTopicSections,
  getTopicsByType,
  pickOne,
  topicTypeLabels,
  type TopicType,
} from "@/lib/topics";
import type { RoomDoc } from "@/lib/types";
import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";

export function TopicDisplay({
  roomId,
  room,
  isHost,
}: {
  roomId: string;
  room: RoomDoc & { id?: string };
  isHost: boolean;
}) {
  const hasTopic = !!room.topic;
  const topicBox = (room as any).topicBox as TopicType | null | undefined;
  const [changingBox, setChangingBox] = useState(false);
  // Only allow host actions when in clue phase (game started)
  const canHostAct = Boolean(isHost && room.status === "clue");

  const startBox = async (type: TopicType) => {
    if (!canHostAct) return;
    const sections = await fetchTopicSections();
    const pool = getTopicsByType(sections, type);
    const picked = pickOne(pool) || null;
    await updateDoc(doc(db!, "rooms", roomId), {
      topicBox: type,
      topicOptions: null,
      topic: picked,
    });
  };

  const shuffleBox = async () => {
    if (!canHostAct) return;
    if (!topicBox) return;
    const sections = await fetchTopicSections();
    const pool = getTopicsByType(sections, topicBox);
    const picked = pickOne(pool) || null;
    await updateDoc(doc(db!, "rooms", roomId), { topic: picked });
  };

  const changeCategory = async (type: TopicType) => {
    if (!canHostAct) return;
    await startBox(type);
    setChangingBox(false);
  };

  // 直接お題を選ぶUIは撤去（カテゴリ選択で即ランダム決定）

  return (
    <Panel title="お題">
      {hasTopic ? (
        <Stack>
          <HStack justify="space-between" alignItems="center">
            <Stack gap={0}>
              <Text fontWeight="bold" fontSize="lg">
                {room.topic}
              </Text>
              {!!topicBox && (
                <Text color="gray.300" fontSize="sm">
                  カテゴリ: {topicBox}
                </Text>
              )}
            </Stack>
            <HStack>
              {isHost && !!topicBox && room.status === "clue" && !room.deal && (
                <Button size="sm" variant="outline" onClick={shuffleBox}>
                  シャッフル
                </Button>
              )}
              {isHost && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setChangingBox((v) => !v)}
                  disabled={!canHostAct}
                >
                  カテゴリ変更
                </Button>
              )}
              {isHost && (
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!canHostAct) return;
                    try {
                      await dealNumbers(roomId);
                      notify({ title: "数字を配りました", type: "success" });
                    } catch (e: any) {
                      notify({
                        title: "数字の配布に失敗",
                        description: e?.message || String(e),
                        type: "error",
                      });
                    }
                  }}
                  disabled={!canHostAct}
                >
                  数字を配る
                </Button>
              )}
            </HStack>
          </HStack>
          {changingBox && (
            <Stack>
              <Text color="gray.300" fontSize="sm">
                カテゴリを選択
              </Text>
              <HStack>
                {topicTypeLabels.map((label) => (
                  <Button
                    key={label}
                    size="sm"
                    onClick={() => changeCategory(label)}
                    disabled={!canHostAct}
                    variant={canHostAct ? "solid" : "outline"}
                  >
                    {label}
                  </Button>
                ))}
              </HStack>
            </Stack>
          )}
          {!room.deal && (
            <Text color="orange.300" fontSize="sm">
              数字が未配布です。ホストが「数字を配る」を押してください。
            </Text>
          )}
        </Stack>
      ) : (
        <Stack>
          <Text color="gray.300">
            {isHost
              ? "カテゴリを選択（ホストのみ）"
              : "ホストがカテゴリを選ぶまでお待ちください"}
          </Text>
          <HStack>
            {topicTypeLabels.map((label) => (
              <Button
                key={label}
                onClick={() => startBox(label)}
                disabled={!isHost}
                variant={isHost ? "solid" : "outline"}
              >
                {label}
              </Button>
            ))}
          </HStack>
        </Stack>
      )}
    </Panel>
  );
}
