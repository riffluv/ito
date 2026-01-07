import type { RoomStats } from "@/lib/types";
import { Box, Flex, Text } from "@chakra-ui/react";

export type LedgerStatsSummary = {
  gameCount: number;
  successCount: number;
  failureCount: number;
  currentStreak: number;
  bestStreak: number;
  winRate: number;
  hasRecord: boolean;
};

function clampStat(value: number | undefined | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function buildLedgerStatsSummary(stats?: RoomStats | null): LedgerStatsSummary {
  if (!stats) {
    return {
      gameCount: 0,
      successCount: 0,
      failureCount: 0,
      currentStreak: 0,
      bestStreak: 0,
      winRate: 0,
      hasRecord: false,
    };
  }

  const gameCount = clampStat(stats.gameCount);
  const successCount = Math.min(clampStat(stats.successCount), gameCount);
  const inferredFailure = Math.max(gameCount - successCount, 0);
  const explicitFailure = clampStat(stats.failureCount);
  const failureCount = Math.min(
    explicitFailure > 0 ? explicitFailure : inferredFailure,
    gameCount
  );
  const currentStreak = clampStat(stats.currentStreak);
  const bestStreak = Math.max(currentStreak, clampStat(stats.bestStreak));
  const winRate = gameCount > 0 ? Math.round((successCount / gameCount) * 100) : 0;
  const hasRecord =
    gameCount > 0 ||
    successCount > 0 ||
    failureCount > 0 ||
    currentStreak > 0 ||
    bestStreak > 0;

  return {
    gameCount,
    successCount,
    failureCount,
    currentStreak,
    bestStreak,
    winRate,
    hasRecord,
  };
}

export function BattleRecordStatsBadge({ summary }: { summary: LedgerStatsSummary }) {
  return (
    <Box
      px={{ base: "11px", md: "14px" }}
      py={{ base: "6px", md: "7px" }}
      minW={{ base: "auto", md: "auto" }}
      bg="rgba(8,6,14,0.88)"
      border="2px solid rgba(255,215,0,0.82)"
      borderRadius="0"
      boxShadow="0 0 14px rgba(255,215,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.45)"
      color="white"
      fontFamily="monospace"
      position="relative"
      _before={{
        content: '""',
        position: "absolute",
        inset: "2px",
        border: "1px solid rgba(255,215,0,0.35)",
        pointerEvents: "none",
      }}
    >
      {summary.hasRecord ? (
        <Flex align="center" gap={{ base: "9px", md: "12px" }}>
          <StatsColumn
            label="CURRENT"
            value={summary.currentStreak}
            caption={summary.currentStreak > 0 ? "連勝中" : "次勝利で連勝"}
          />
          <Box
            w="2px"
            h={{ base: "36px", md: "40px" }}
            bg="rgba(255,215,0,0.72)"
            boxShadow="0 0 8px rgba(255,215,0,0.45), inset 0 0 2px rgba(255,255,255,0.3)"
          />
          <StatsColumn label="BEST" value={summary.bestStreak} caption="最高記録" />
          <Box
            w="2px"
            h={{ base: "36px", md: "40px" }}
            bg="rgba(255,215,0,0.72)"
            boxShadow="0 0 8px rgba(255,215,0,0.45), inset 0 0 2px rgba(255,255,255,0.3)"
          />
          <Box minW={0}>
            <Text
              fontSize="8px"
              letterSpacing="0.28em"
              color="rgba(255,215,0,0.88)"
              textTransform="uppercase"
              textShadow="1px 1px 0 rgba(0,0,0,0.8), 0 0 6px rgba(255,215,0,0.4)"
              fontWeight={700}
              mb="1px"
            >
              通算
            </Text>
            <Text
              fontSize={{ base: "18px", md: "20px" }}
              fontWeight={900}
              letterSpacing="0.02em"
              color="#FFD700"
              textShadow="1px 1px 0 rgba(0,0,0,0.9), 0 0 12px rgba(255,215,0,0.65)"
              lineHeight="1"
            >
              {summary.gameCount}
              <Text
                as="span"
                fontSize="11px"
                ml="4px"
                color="rgba(255,255,255,0.85)"
                textShadow="1px 1px 0 rgba(0,0,0,0.8)"
              >
                戦
              </Text>
            </Text>
            <Text
              fontSize="9px"
              letterSpacing="0.02em"
              color="rgba(255,255,255,0.78)"
              textShadow="1px 1px 0 rgba(0,0,0,0.7)"
              mt="1px"
            >
              {summary.successCount}勝 {summary.failureCount}敗 · {summary.winRate}%
            </Text>
          </Box>
        </Flex>
      ) : (
        <Flex align="center" gap="8px">
          <Text
            fontSize="9px"
            letterSpacing="0.1em"
            textTransform="uppercase"
            color="rgba(255,215,0,0.75)"
            textShadow="1px 1px 0 rgba(0,0,0,0.8)"
            fontWeight={700}
          >
            RECORD STANDBY
          </Text>
          <Text
            fontSize="10px"
            letterSpacing="0.02em"
            color="rgba(255,255,255,0.82)"
            textShadow="1px 1px 0 rgba(0,0,0,0.7)"
          >
            戦績はまだありません
          </Text>
        </Flex>
      )}
    </Box>
  );
}

function StatsColumn({
  label,
  value,
  caption,
  unit = "連勝",
}: {
  label: string;
  value: number;
  caption: string;
  unit?: string;
}) {
  return (
    <Box minW={0}>
      <Text
        fontSize="8px"
        letterSpacing="0.28em"
        color="rgba(255,215,0,0.88)"
        textTransform="uppercase"
        textShadow="1px 1px 0 rgba(0,0,0,0.8), 0 0 6px rgba(255,215,0,0.4)"
        fontWeight={700}
        mb="1px"
      >
        {label}
      </Text>
      <Text
        fontSize={{ base: "18px", md: "20px" }}
        fontWeight={900}
        letterSpacing="0.02em"
        color="#FFD700"
        textShadow="1px 1px 0 rgba(0,0,0,0.9), 0 0 12px rgba(255,215,0,0.65)"
        lineHeight="1"
      >
        {value}
        <Text
          as="span"
          fontSize="11px"
          ml="4px"
          color="rgba(255,255,255,0.85)"
          textShadow="1px 1px 0 rgba(0,0,0,0.8)"
        >
          {unit}
        </Text>
      </Text>
      <Text
        fontSize="9px"
        letterSpacing="0.02em"
        color="rgba(255,255,255,0.78)"
        textShadow="1px 1px 0 rgba(0,0,0,0.7)"
        mt="1px"
      >
        {caption}
      </Text>
    </Box>
  );
}

