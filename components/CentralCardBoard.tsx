"use client";
import { SortableItem } from "@/components/sortable/SortableItem";
import { Panel } from "@/components/ui/Panel";
import { notify } from "@/components/ui/notify";
import {
  addCardToProposal,
  commitPlayFromClue,
  setOrderProposal,
} from "@/lib/game/room";
import type { PlayerDoc } from "@/lib/types";
import { Box, Text } from "@chakra-ui/react";
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import React, { useEffect, useMemo, useState } from "react";

export function CentralCardBoard({
  roomId,
  players,
  orderList,
  meId,
  eligibleIds,
  roomStatus,
  proposal,
  cluesReady,
  failed,
  failedAt,
  resolveMode,
}: {
  roomId: string;
  players: (PlayerDoc & { id: string })[];
  orderList: string[];
  meId: string;
  eligibleIds: string[];
  roomStatus?: string;
  proposal?: string[];
  cluesReady?: boolean;
  failed?: boolean;
  failedAt?: number | null;
  resolveMode?: string;
}) {
  const map = new Map(players.map((p) => [p.id, p]));
  const [pending, setPending] = useState<string[]>([]);
  const [isOver, setIsOver] = useState(false);

  // If server-side orderList contains an id, clear it from pending
  useEffect(() => {
    if (!orderList || orderList.length === 0) return;
    setPending((cur) => cur.filter((id) => !orderList.includes(id)));
  }, [orderList.join(",")]);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const pid = e.dataTransfer.getData("text/plain");
    if (!pid) return;
    setIsOver(false);
    if (pid !== meId) {
      notify({ title: "自分のカードをドラッグしてください", type: "info" });
      return;
    }
    const me = map.get(meId as string) as any;
    if (!me || typeof me.number !== "number") {
      notify({ title: "数字が割り当てられていません", type: "warning" });
      return;
    }
    if (roomStatus !== "clue") {
      notify({ title: "今はカードを出せません", type: "info" });
      return;
    }
    if (resolveMode === "sort-submit") {
      // 判定はまだ行わない。proposal に追加。
      try {
        await addCardToProposal(roomId, meId);
        setPending((p) => (p.includes(pid) ? p : [...p, pid]));
        notify({ title: "カードを場に置きました", type: "success" });
      } catch (err: any) {
        notify({
          title: "配置に失敗しました",
          description: err?.message,
          type: "error",
        });
      }
      return;
    }
    // 従来モード: 全員の連想ワード確定後に即判定
    if (!cluesReady) {
      notify({
        title: "全員が連想ワードを決定してから出してください",
        type: "info",
      });
      return;
    }
    try {
      await commitPlayFromClue(roomId, meId);
      setPending((p) => (p.includes(pid) ? p : [...p, pid]));
      notify({ title: "カードを場に置きました（判定実行）", type: "success" });
    } catch (err: any) {
      notify({
        title: "配置に失敗しました",
        description: err?.message,
        type: "error",
      });
    }
  };

  // helper to render a card box
  const renderCard = (id: string, idx?: number) => {
    const p = map.get(id) as any;
    const number = p?.number;
    const isPlaced =
      (orderList || []).includes(id) ||
      pending.includes(id) ||
      (proposal || []).includes(id);
    let showNumber = typeof number === "number" && isPlaced;
    if (resolveMode === "sort-submit" && roomStatus !== "finished") {
      showNumber = false; // 判定前は伏せ
    }
    const violation =
      failed &&
      typeof failedAt === "number" &&
      idx !== undefined &&
      failedAt === idx + 1; // 1-based failedAt
    return (
      <Box
        key={id}
        p={3}
        style={{
          minWidth: 140,
          minHeight: 160,
          borderRadius: 12,
          background: violation
            ? "linear-gradient(180deg, rgba(200,40,40,0.35), rgba(0,0,0,0.1))"
            : "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(255,255,255,0.04)",
          boxShadow: violation
            ? "0 0 0 2px rgba(255,80,80,0.6), inset 0 -6px 18px rgba(0,0,0,0.4)"
            : "inset 0 -6px 18px rgba(0,0,0,0.2)",
        }}
      >
        {typeof idx === "number" && <Text fontSize="sm">#{idx + 1}</Text>}
        <Text fontWeight="900" fontSize="xl" textAlign="center">
          {resolveMode === "sort-submit" && roomStatus !== "finished"
            ? p?.clue1 || "(連想待ち)"
            : showNumber
            ? number
            : "?"}
        </Text>
        <Text mt={2} fontSize="xs" color="fgMuted">
          {p?.name ?? "(不明)"}
        </Text>
        {violation && (
          <Text mt={2} fontSize="xs" color="red.300" fontWeight="bold">
            ← ここで失敗！
          </Text>
        )}
      </Box>
    );
  };

  // sort-submit 用 DnD 並べ替え
  const activeProposal = useMemo(() => proposal || [], [proposal?.join(",")]);
  const onDragEnd = async (e: DragEndEvent) => {
    if (resolveMode !== "sort-submit" || roomStatus !== "clue") return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = activeProposal.indexOf(String(active.id));
    const newIndex = activeProposal.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(activeProposal, oldIndex, newIndex);
    try {
      await setOrderProposal(roomId, reordered);
    } catch {
      /* ignore */
    }
  };

  return (
    <Panel title="カードボード（出した順）">
      <div style={{ position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div
            style={{
              display: "inline-block",
              padding: "6px 12px",
              background: "rgba(123,211,182,0.08)",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            🎯 カードボード（出した順）
          </div>
        </div>
        {failed && (
          <div
            style={{
              position: "absolute",
              top: -10,
              right: 0,
              transform: "translateY(-100%)",
              background:
                "linear-gradient(90deg, rgba(255,70,70,0.9), rgba(120,0,0,0.9))",
              padding: "6px 14px",
              borderRadius: 12,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: 1,
              boxShadow: "0 4px 18px -4px rgba(255,0,0,0.4)",
              zIndex: 10,
            }}
          >
            失敗！昇順が崩れました（#{failedAt} 枚目）
          </div>
        )}
        {/* no separate header hint; placeholder inside board will show waiting message when appropriate */}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            // only show hover highlight when drops are allowed
            if (!(roomStatus === "clue" && cluesReady === false)) {
              setIsOver(true);
            }
          }}
          onDragLeave={() => setIsOver(false)}
          onDrop={onDrop}
          style={{
            position: "relative",
            minHeight: 220,
            border: isOver
              ? "2px dashed var(--chakra-colors-accent)"
              : "2px dashed rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: 16,
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
            background: isOver
              ? "rgba(78,205,196,0.04)"
              : "repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 8px, transparent 8px, transparent 16px)",
            transition: "all 150ms ease",
          }}
        >
          {resolveMode === "sort-submit" && roomStatus === "clue" ? (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={activeProposal}>
                {activeProposal.length > 0 &&
                  activeProposal.map((id, idx) => (
                    <SortableItem id={id} key={id}>
                      {renderCard(id, idx)}
                    </SortableItem>
                  ))}
              </SortableContext>
            </DndContext>
          ) : (
            <>
              {orderList &&
                orderList.length > 0 &&
                orderList.map((id, idx) => renderCard(id, idx))}
              {proposal && proposal.length > 0
                ? proposal
                    .filter((id) => !orderList?.includes(id))
                    .map((id) => renderCard(id))
                : null}
            </>
          )}

          {/* optimistic local pending (fallback) */}
          {resolveMode === "sort-submit" &&
            roomStatus === "clue" &&
            activeProposal.length === 0 && (
              <Text color="gray.400">
                自分のカードをドラッグして場に置き、連想ワードで相談しましょう。
              </Text>
            )}
          {resolveMode !== "sort-submit" &&
            (!orderList || orderList.length === 0) &&
            (!proposal || proposal.length === 0) &&
            pending.length === 0 &&
            (roomStatus === "clue" && cluesReady === false ? (
              <div role="status" aria-live="polite">
                <Text fontWeight={700} color="fgMuted">
                  全員が連想ワードを決定するまでお待ちください
                </Text>
              </div>
            ) : (
              <Text color="gray.400">
                まだカードが出されていません。自分のカードをドラッグしてここに置いてください。
              </Text>
            ))}

          {resolveMode !== "sort-submit" && pending && pending.length > 0
            ? pending
                .filter((id) => !(orderList || []).includes(id))
                .filter((id) => !(proposal || []).includes(id))
                .map((id) => renderCard(id))
            : null}
          {/* 失敗後も継続可能: 下部に説明 */}
          {failed && (
            <div style={{ flexBasis: "100%" }}>
              <Text fontSize="sm" color="red.300">
                失敗後も全員のカードが出揃うまで並べ続けます。
              </Text>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default CentralCardBoard;
