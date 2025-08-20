"use client";
import { Panel } from "@/components/ui/Panel";
import { toaster } from "@/components/ui/toaster";
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

  const startBox = async (type: TopicType) => {
    if (!isHost) return;
    const sections = await fetchTopicSections();
    const pool = getTopicsByType(sections, type);
    const picked = pickOne(pool) || null;
    await updateDoc(doc(db, "rooms", roomId), {
      topicBox: type,
      topicOptions: null,
      topic: picked,
    });
  };

  const shuffleBox = async () => {
    if (!isHost) return;
    if (!topicBox) return;
    const sections = await fetchTopicSections();
    const pool = getTopicsByType(sections, topicBox);
    const picked = pickOne(pool) || null;
    await updateDoc(doc(db, "rooms", roomId), { topic: picked });
  };

  const changeCategory = async (type: TopicType) => {
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
              {isHost && !!topicBox && !room.deal && (
                <Button size="sm" variant="outline" onClick={shuffleBox}>
                  シャッフル
                </Button>
              )}
              {isHost && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setChangingBox((v) => !v)}
                >
                  カテゴリ変更
                </Button>
              )}
              {isHost && (
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await dealNumbers(roomId);
                      toaster.create({
                        title: "数字を配りました",
                        type: "success",
                      });
                    } catch (e: any) {
                      toaster.create({
                        title: "数字の配布に失敗",
                        description: e?.message || String(e),
                        type: "error",
                      });
                    }
                  }}
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
                    disabled={!isHost}
                    variant={isHost ? "solid" : "outline"}
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
