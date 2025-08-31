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
    <Panel 
      title="順番に出す" 
      role="region" 
      aria-label="場（出した順）"
      css={{
        // 🎮 PREMIUM PANEL STYLING
        background: `
          linear-gradient(135deg, 
            rgba(101,67,33,0.1) 0%, 
            rgba(80,53,26,0.2) 100%
          )
        `,
        border: "1px solid rgba(160,133,91,0.3)",
        backdropFilter: "blur(10px)",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      }}
    >
      <Stack>
        {!failed ? (
          <Text color="rgba(255,255,255,0.8)" css={{
            textShadow: "0 1px 4px rgba(0,0,0,0.6)",
          }}>
            低いと思った人から順に「出す」を押してください。順番を間違えると失敗になります。
          </Text>
        ) : (
          <Text fontWeight="bold" css={{
            color: "#f87171",
            textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          }}>
            失敗！！　最後までカード出して数字を確認しましょう。
          </Text>
        )}

        <Stack>
          <Text fontWeight="bold" css={{
            color: "#ffd700",
            textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          }}>
            場に出たカード
          </Text>
          {played.length === 0 ? (
            <Text color="rgba(255,255,255,0.6)" css={{
              textShadow: "0 1px 4px rgba(0,0,0,0.6)",
            }}>
              まだ誰も出していません
            </Text>
          ) : (
            <Stack>
              {played.map((p, idx) => (
                <HStack
                  key={p.id}
                  justify="space-between"
                  p={3}
                  rounded="12px"
                  css={{
                    // 🎮 PREMIUM CARD ROW
                    background: failed && failedAt === idx + 1 
                      ? "linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(220,38,38,0.3) 100%)"
                      : "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
                    border: failed && failedAt === idx + 1 
                      ? "1px solid rgba(239,68,68,0.5)"
                      : "1px solid rgba(255,255,255,0.2)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Text css={{
                    color: "#ffffff",
                    textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                  }}>
                    #{idx + 1} {p.name}
                  </Text>
                  <Text fontWeight="bold" css={{
                    color: "#fbbf24",
                    textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                    fontSize: "1.1rem",
                  }}>
                    {p.number ?? "?"}
                  </Text>
                </HStack>
              ))}
            </Stack>
          )}
        </Stack>

        <Stack>
          <Text fontWeight="bold" css={{
            color: "#ffd700",
            textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          }}>
            まだ出していないプレイヤー
          </Text>
          {waiting.length === 0 ? (
            <Text color="rgba(255,255,255,0.6)" css={{
              textShadow: "0 1px 4px rgba(0,0,0,0.6)",
            }}>
              全員出し終わりました
            </Text>
          ) : (
            <Stack>
              {waiting.map((p) => (
                <HStack
                  key={p.id}
                  justify="space-between"
                  p={3}
                  rounded="12px"
                  css={{
                    // 🎮 PREMIUM WAITING ROW
                    background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Text css={{
                    color: "#ffffff",
                    textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                  }}>
                    {p.name}
                  </Text>
                  {/* Removed category/badge/icon per request; keep only the action button */}
                  {p.id === meId ? (
                    <AppButton
                      onClick={onPlay}
                      colorPalette="orange"
                      loading={submitting}
                      disabled={!canPlay}
                      css={{
                        // 🎮 PREMIUM PLAY BUTTON
                        background: "linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.3) 100%)",
                        border: "1px solid rgba(245,158,11,0.5)",
                        color: "#fbbf24",
                        _hover: {
                          background: "linear-gradient(135deg, rgba(245,158,11,0.3) 0%, rgba(217,119,6,0.4) 100%)",
                          transform: "translateY(-2px)",
                          boxShadow: "0 6px 20px rgba(245,158,11,0.2)",
                        },
                        _disabled: {
                          opacity: 0.5,
                          cursor: "not-allowed",
                          _hover: {
                            transform: "none",
                            background: "initial",
                          },
                        },
                      }}
                    >
                      出す
                    </AppButton>
                  ) : (
                    <AppButton 
                      variant="outline" 
                      disabled
                      css={{
                        // 🎮 PREMIUM DISABLED BUTTON
                        background: "rgba(107,114,128,0.1)",
                        border: "1px solid rgba(107,114,128,0.3)",
                        color: "rgba(107,114,128,0.6)",
                      }}
                    >
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