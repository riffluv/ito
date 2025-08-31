"use client";
import { AppButton } from "@/components/ui/AppButton";
import { Panel } from "@/components/ui/Panel";
import { notify } from "@/components/ui/notify";
import { commitPlayFromClue } from "@/lib/game/room";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { HStack, Stack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";

export function PlayBoard({
  roomId,
  players,
  meId,
  orderList,
  isHost: _isHost,
  failed = false,
  failedAt = null,
  eligibleIds,
}: {
  roomId: string;
  players: (PlayerDoc & { id: string })[];
  meId: string;
  orderList: string[];
  isHost: boolean;
  failed?: boolean;
  failedAt?: number | null;
  eligibleIds: string[];
}) {
  const [submitting, setSubmitting] = useState(false);

  const me = players.find((p) => p.id === meId);
  const played = useMemo(
    () =>
      orderList
        .map((id) => players.find((p) => p.id === id))
        .filter(Boolean) as (PlayerDoc & { id: string })[],
    [orderList.join(","), players.map((p) => p.id).join(",")]
  );
  const waiting = useMemo(() => {
    const set = new Set(eligibleIds);
    return players.filter((p) => set.has(p.id) && !orderList.includes(p.id));
  }, [
    orderList.join(","),
    players.map((p) => p.id).join(","),
    eligibleIds.join(","),
  ]);

  const canPlay =
    !!me &&
    me.number != null &&
    !orderList.includes(me.id) &&
    eligibleIds.includes(me.id);

  const onPlay = async () => {
    if (!canPlay) return;
    setSubmitting(true);
    try {
      await commitPlayFromClue(roomId, meId);
    } catch (e: any) {
      notify({
        title: "出せませんでした",
        description: e?.message,
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel title="順番に出す" role="region" aria-label="場（出した順）">
      <Stack>
        {!failed ? (
          <Text color="fgMuted">
            低いと思った人から順に「出す」を押してください。順番を間違えると失敗になります。
          </Text>
        ) : (
          <Text color="dangerSolid" fontWeight="bold">
            失敗！！　最後までカード出して数字を確認しましょう。
          </Text>
        )}

        <Stack>
          <Text fontWeight="bold">場に出たカード</Text>
          {played.length === 0 ? (
            <Text color="fgMuted">まだ誰も出していません</Text>
          ) : (
            <Stack>
              {played.map((p, idx) => (
                <HStack
                  key={p.id}
                  justify="space-between"
                  p={2}
                  rounded="md"
                  bg={failed && failedAt === idx + 1 ? "red.900" : "panelSubBg"}
                  boxShadow={UNIFIED_LAYOUT.ELEVATION.CARD.RAISED}
                >
                  <Text>
                    #{idx + 1} {p.name}
                  </Text>
                  <Text fontWeight="bold" color="yellow.300">
                    {p.number ?? "?"}
                  </Text>
                </HStack>
              ))}
            </Stack>
          )}
        </Stack>

        <Stack>
          <Text fontWeight="bold">まだ出していないプレイヤー</Text>
          {waiting.length === 0 ? (
            <Text color="fgMuted">全員出し終わりました</Text>
          ) : (
            <Stack>
              {waiting.map((p) => (
                <HStack
                  key={p.id}
                  justify="space-between"
                  p={2}
                  rounded="md"
                  bg="panelSubBg"
                  boxShadow={UNIFIED_LAYOUT.ELEVATION.CARD.RAISED}
                >
                  <Text>{p.name}</Text>
                  {/* Removed category/badge/icon per request; keep only the action button */}
                  {p.id === meId ? (
                    <AppButton
                      onClick={onPlay}
                      colorPalette="orange"
                      loading={submitting}
                      disabled={!canPlay}
                    >
                      出す
                    </AppButton>
                  ) : (
                    <AppButton variant="outline" disabled>
                      出す
                    </AppButton>
                  )}
                </HStack>
              ))}
            </Stack>
          )}
        </Stack>
      </Stack>
    </Panel>
  );
}
