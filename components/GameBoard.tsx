"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { PlayerDoc, RoomOptions } from "@/lib/types";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";

function SortableItem({ id, name, index, showNumber, number }: { id: string; name: string; index: number; showNumber: boolean; number: number | null; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderWidth: "1px",
    borderRadius: "8px",
    padding: "8px 12px",
    background: isDragging ? "rgba(63,81,181,0.2)" : "rgba(255,255,255,0.06)",
  } as React.CSSProperties;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <HStack justify="space-between">
        <Text>#{index + 1} {name}</Text>
        {showNumber && <Text fontWeight="bold" color="yellow.300">{number ?? "?"}</Text>}
      </HStack>
    </div>
  );
}

export function GameBoard({
  roomId,
  meId,
  options,
  players,
  isAllReady,
  onAllReady,
  reveal,
  canFinalize,
  onFinalize,
  isHost = false,
}: {
  roomId: string;
  meId: string;
  options: RoomOptions;
  players: (PlayerDoc & { id: string })[];
  isAllReady: boolean;
  onAllReady?: () => void;
  reveal?: boolean;
  canFinalize?: boolean;
  onFinalize?: (success: boolean) => void;
  isHost?: boolean;
}) {
  const toast = useToast();
  const me = players.find((p) => p.id === meId)!;
  const allClue1 = players.every((p) => p.clue1 && p.clue1.trim().length > 0);
  const allClue2 = !options.allowSecondClue || players.every((p) => p.clue2 && p.clue2.trim().length > 0);

  const stage: "clue1" | "clue2" | "order" = !allClue1 ? "clue1" : !allClue2 ? "clue2" : "order";

  const [localOrder, setLocalOrder] = useState<string[]>(() => players.slice().sort((a,b)=>a.orderIndex-b.orderIndex).map((p) => p.id));
  const [clue1Text, setClue1Text] = useState<string>(me?.clue1 || "");
  const [clue2Text, setClue2Text] = useState<string>(me?.clue2 || "");
  useEffect(() => {
    // 参加者更新や保存後に初期化
    const sorted = players.slice().sort((a,b)=>a.orderIndex-b.orderIndex).map((p) => p.id);
    setLocalOrder(sorted);
  }, [players.length]);

  useEffect(() => {
    setClue1Text(me?.clue1 || "");
    setClue2Text(me?.clue2 || "");
  }, [me?.clue1, me?.clue2]);

  const sensors = useSensors(useSensor(PointerSensor));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = localOrder.indexOf(String(active.id));
    const newIndex = localOrder.indexOf(String(over.id));
    setLocalOrder((ids) => arrayMove(ids, oldIndex, newIndex));
  };

  const saveOrder = async () => {
    const batch = writeBatch(db);
    localOrder.forEach((pid, idx) => {
      batch.update(doc(db, "rooms", roomId, "players", pid), { orderIndex: idx });
    });
    await batch.commit();
    toast({ title: "並びを保存しました", status: "success" });
  };

  const submitClue = async (key: "clue1" | "clue2") => {
    const value = (key === "clue1" ? clue1Text : clue2Text).trim();
    if (key === "clue1" && !value) {
      toast({ title: "ヒント1を入力してください", status: "warning" });
      return;
    }
    await updateDoc(doc(db, "rooms", roomId, "players", meId), { [key]: value });
    toast({ title: `${key.toUpperCase()} を送信しました`, status: "success" });
    if (key === "clue1") setClue1Text("");
    if (key === "clue2") setClue2Text("");
  };

  const setReady = async () => {
    await updateDoc(doc(db, "rooms", roomId, "players", meId), { ready: true });
    if (onAllReady) onAllReady();
  };

  const resetReady = async () => {
    await updateDoc(doc(db, "rooms", roomId, "players", meId), { ready: false });
  };

  const computed = useMemo(() => {
    const ordered = localOrder.map((id) => players.find((p) => p.id === id)!).filter(Boolean);
    const numbers = ordered.map((p) => p.number ?? 0);
    const sorted = [...numbers].sort((a, b) => a - b);
    const success = numbers.every((n, i) => n === sorted[i]);
    return { ordered, numbers, sorted, success };
  }, [localOrder, players]);

  return (
    <Stack spacing={4}>
      {stage !== "order" && (
        <Box p={4} borderWidth="1px" rounded="md" bg="blackAlpha.300">
          <Heading size="sm" mb={2}>ヒント入力</Heading>
          <Stack spacing={3}>
            <Box p={3} borderWidth="1px" rounded="md" bg="blackAlpha.400">
              <Text fontSize="sm" color="gray.300">あなたの数字（自分にだけ表示）</Text>
              <Heading size="lg" color="yellow.300">{me.number ?? "?"}</Heading>
            </Box>
            <HStack>
              <Input
                placeholder="ヒント1（必須）"
                value={clue1Text}
                onChange={(e) => setClue1Text(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitClue("clue1"); } }}
              />
              <Button onClick={() => submitClue("clue1")} colorScheme="blue">送信</Button>
            </HStack>
            {options.allowSecondClue && allClue1 && (
              <HStack>
                <Input
                  placeholder="ヒント2（任意）"
                  value={clue2Text}
                  onChange={(e) => setClue2Text(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitClue("clue2"); } }}
                />
                <Button onClick={() => submitClue("clue2")} colorScheme="purple">送信</Button>
              </HStack>
            )}
            <Text color="gray.300">他の人の画面には数字は表示されません（公開まで非表示）</Text>
          </Stack>
        </Box>
      )}

      {stage === "order" && (
        <Box p={4} borderWidth="1px" rounded="md" bg="blackAlpha.300">
          <Heading size="sm" mb={3}>カードを並べ替え</Heading>
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
              <Stack>
                {localOrder.map((id, idx) => {
                  const p = players.find((pp) => pp.id === id)!;
                  return (
                    <SortableItem key={id} id={id} name={`${p.name}${p.id === meId ? " (自分)" : ""}`} index={idx} showNumber={!!reveal} number={p.number} />
                  );
                })}
              </Stack>
            </SortableContext>
          </DndContext>
          <HStack mt={3}>
            {isHost ? (
              <Button onClick={saveOrder} colorScheme="blue">並びを保存（ホスト）</Button>
            ) : (
              <Button isDisabled variant="outline" title="ホストが保存します">並びを保存</Button>
            )}
            {!isAllReady ? (
              <Button onClick={setReady} variant="outline">この並びで確認</Button>
            ) : (
              <Button onClick={resetReady} variant="ghost">確認取り消し</Button>
            )}
          </HStack>
        </Box>
      )}

      {isAllReady && (
        <Box p={4} borderWidth="1px" rounded="md" bg="blackAlpha.400">
          <Heading size="sm" mb={2}>答え合わせ</Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
            {computed.ordered.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <HStack justify="space-between" p={2} borderWidth="1px" rounded="md">
                  <Text>#{i + 1} {p.name}</Text>
                  <Text fontWeight="bold" color="yellow.300">{p.number}</Text>
                </HStack>
              </motion.div>
            ))}
          </SimpleGrid>
          <Text mt={3} fontWeight="bold" color={computed.success ? "green.300" : "red.300"}>
            {computed.success ? "並びが完全一致！クリア！" : "残念！順番が違います"}
          </Text>
          {canFinalize && (
            <HStack mt={3}>
              <Button colorScheme="blue" onClick={() => onFinalize?.(computed.success)}>結果を確定</Button>
            </HStack>
          )}
        </Box>
      )}
    </Stack>
  );
}
