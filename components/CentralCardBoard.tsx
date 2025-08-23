"use client";
import { Panel } from "@/components/ui/Panel";
import { notify } from "@/components/ui/notify";
import { commitPlayFromClue, playCard } from "@/lib/game/room";
import type { PlayerDoc } from "@/lib/types";
import { Box, Text } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";

export function CentralCardBoard({
  roomId,
  players,
  orderList,
  meId,
  eligibleIds,
  roomStatus,
  proposal,
  cluesReady,
}: {
  roomId: string;
  players: (PlayerDoc & { id: string })[];
  orderList: string[];
  meId: string;
  eligibleIds: string[];
  roomStatus?: string;
  proposal?: string[];
  cluesReady?: boolean;
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

    // If room is playing, perform server play
    if (roomStatus === "playing") {
      try {
        await playCard(roomId, meId);
      } catch (err: any) {
        notify({
          title: "カードを出せませんでした（サーバ）",
          description: err?.message,
          type: "error",
        });
      }
      return;
    }
    // If in clue phase, only allow drop when all players have decided their clues
    if (roomStatus === "clue") {
      if (!cluesReady) {
        notify({
          title: "全員が連想ワードを決定してから出してください",
          type: "info",
        });
        return;
      }
      try {
        await commitPlayFromClue(roomId, meId);
        // optimistic local pending until server updates reflect the new order
        setPending((p) => (p.includes(pid) ? p : [...p, pid]));
        notify({
          title: "カードを場に置きました（判定実行）",
          type: "success",
        });
      } catch (err: any) {
        notify({
          title: "配置に失敗しました",
          description: err?.message,
          type: "error",
        });
      }
      return;
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
    const showNumber = typeof number === "number" && isPlaced;
    return (
      <Box
        key={id}
        p={3}
        style={{
          minWidth: 140,
          minHeight: 160,
          borderRadius: 12,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(255,255,255,0.04)",
          boxShadow: "inset 0 -6px 18px rgba(0,0,0,0.2)",
        }}
      >
        {typeof idx === "number" && <Text fontSize="sm">#{idx + 1}</Text>}
        <Text fontWeight="900" fontSize="2xl">
          {showNumber ? number : "?"}
        </Text>
        <Text mt={2} fontSize="sm" color="fgMuted">
          {p?.name ?? "(不明)"}
        </Text>
      </Box>
    );
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
        {/* overlay when clues not ready */}
        {roomStatus === "clue" && cluesReady === false && (
          <div
            style={{
              position: "absolute",
              inset: 12,
              borderRadius: 12,
              background: "rgba(4,6,8,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 5,
              pointerEvents: "none",
            }}
          >
            <Text color="white" fontWeight="700">
              全員が連想ワードを決定するまでお待ちください
            </Text>
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsOver(true);
          }}
          onDragLeave={() => setIsOver(false)}
          onDrop={onDrop}
          style={{
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
          {/* committed plays */}
          {orderList &&
            orderList.length > 0 &&
            orderList.map((id, idx) => renderCard(id, idx))}

          {/* proposals (not yet committed) */}
          {proposal && proposal.length > 0
            ? proposal
                .filter((id) => !orderList?.includes(id))
                .map((id) => renderCard(id))
            : null}

          {/* optimistic local pending (fallback) */}
          {(!orderList || orderList.length === 0) &&
          (!proposal || proposal.length === 0) &&
          pending.length === 0 ? (
            <Text color="gray.400">
              まだカードが出されていません。自分のカードをドラッグしてここに置いてください。
            </Text>
          ) : null}

          {pending && pending.length > 0
            ? pending
                .filter((id) => !(orderList || []).includes(id))
                .filter((id) => !(proposal || []).includes(id))
                .map((id) => renderCard(id))
            : null}
        </div>
      </div>
    </Panel>
  );
}

export default CentralCardBoard;
