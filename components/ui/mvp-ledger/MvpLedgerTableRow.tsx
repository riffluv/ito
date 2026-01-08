"use client";

import { Box, Button, Flex, Text } from "@chakra-ui/react";
import type {
  LedgerPlayer,
  MvpTally,
} from "@/components/ui/mvp-ledger/mvpLedgerDerivations";

type ResponsiveString = Readonly<{ base: string; md: string }>;

type MvpLedgerTableRowProps = {
  player: LedgerPlayer;
  index: number;
  columnTemplate: ResponsiveString;
  voteControlWidth: ResponsiveString;
  myId: string;
  readOnly: boolean;
  pendingTarget: string | null;
  onVote: (playerId: string) => void;
  mvpStats: MvpTally;
  rowRef?: (el: HTMLDivElement | null) => void;
};

export function MvpLedgerTableRow({
  player,
  index,
  columnTemplate,
  voteControlWidth,
  myId,
  readOnly,
  pendingTarget,
  onVote,
  mvpStats,
  rowRef,
}: MvpLedgerTableRowProps) {
  const isMvp = mvpStats.mvpIds.includes(player.id);
  const isSelf = player.id === myId;
  const voteCount = mvpStats.voteCounts[player.id] || 0;

  const rowBg =
    mvpStats.allVoted && isMvp
      ? mvpStats.isAllTie
        ? "linear-gradient(135deg, rgba(59,130,246,0.27), rgba(37,99,235,0.21))"
        : mvpStats.isTie
        ? "linear-gradient(135deg, rgba(34,197,94,0.26), rgba(22,163,74,0.19))"
        : "linear-gradient(135deg, rgba(255,215,0,0.28), rgba(255,165,0,0.22))"
      : "transparent";

  const rowBorder =
    mvpStats.allVoted && isMvp
      ? mvpStats.isAllTie
        ? "2px solid rgba(59,130,246,0.88)"
        : mvpStats.isTie
        ? "2px solid rgba(34,197,94,0.82)"
        : "2px solid rgba(255,215,0,0.85)"
      : "2px solid transparent";

  const rowHighlightShadow =
    mvpStats.allVoted && isMvp
      ? mvpStats.isAllTie
        ? "0 0 19px rgba(59,130,246,0.52), inset 0 1px 0 rgba(255,255,255,0.16)"
        : mvpStats.isTie
        ? "0 0 17px rgba(34,197,94,0.48), inset 0 1px 0 rgba(255,255,255,0.14)"
        : "0 0 18px rgba(255,215,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)"
      : null;

  const rowHoverBg =
    mvpStats.allVoted && isMvp
      ? mvpStats.isAllTie
        ? "linear-gradient(135deg, rgba(59,130,246,0.33), rgba(37,99,235,0.27))"
        : mvpStats.isTie
        ? "linear-gradient(135deg, rgba(34,197,94,0.31), rgba(22,163,74,0.24))"
        : "linear-gradient(135deg, rgba(255,215,0,0.32), rgba(255,165,0,0.26))"
      : "rgba(255,255,255,0.05)";

  const mvpColor = isMvp
    ? mvpStats.isAllTie
      ? "#3B82F6"
      : mvpStats.isTie
      ? "#22C55E"
      : "#FFD700"
    : "white";

  return (
    <Box
      ref={rowRef}
      display="grid"
      gridTemplateColumns={columnTemplate}
      gap={{ base: "7px", md: "11px" }}
      alignItems="center"
      bg={rowBg}
      borderRadius="0"
      px={{ base: "11px", md: "15px" }}
      py={{ base: "11px", md: "13px" }}
      borderBottom="1px solid rgba(255,255,255,0.08)"
      border={rowBorder}
      boxShadow={[`inset 0 -1px 0 rgba(0,0,0,0.15)`, rowHighlightShadow]
        .filter(Boolean)
        .join(", ")}
      position="relative"
      _hover={{
        bg: rowHoverBg,
      }}
    >
      {/* NO. */}
      <Flex
        justify="center"
        align="center"
        justifySelf="center"
        fontSize={{ base: "14px", md: "16px" }}
        fontWeight={700}
        textShadow="1px 1px 0 rgba(0,0,0,0.7)"
      >
        {String(index + 1).padStart(2, "0")}
      </Flex>

      {/* アバター */}
      <Flex justify="center" align="center" justifySelf="center">
        <Box
          w={{ base: "40px", md: "48px" }}
          h={{ base: "40px", md: "48px" }}
          display="flex"
          alignItems="center"
          justifyContent="center"
          border="2px solid rgba(255,255,255,0.5)"
          bg="rgba(0,0,0,0.4)"
        >
          {player.avatar?.startsWith("/avatars/") ? (
            <img
              src={player.avatar}
              alt={player.name || "avatar"}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8)) contrast(1.1)",
              }}
            />
          ) : (
            <Text
              fontSize={{ base: "22px", md: "26px" }}
              filter="drop-shadow(0 1px 2px rgba(0,0,0,0.8))"
            >
              {player.avatar || "⚔️"}
            </Text>
          )}
        </Box>
      </Flex>

      {/* 名前 */}
      <Box
        textAlign="left"
        justifySelf="start"
        w="100%"
        fontSize={{ base: "14px", md: "15px" }}
        fontWeight={700}
        letterSpacing="0.03em"
        color="rgba(255,255,255,0.94)"
        textShadow="1px 1px 0 rgba(0,0,0,0.6)"
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
      >
        {player.name || "(名無し)"}
      </Box>

      {/* 連想語 */}
      <Box
        textAlign="left"
        justifySelf="start"
        w="100%"
        fontSize={{ base: "13px", md: "14px" }}
        fontWeight={600}
        color="rgba(255,255,255,0.91)"
        textShadow="1px 1px 0 rgba(0,0,0,0.5)"
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
        title={player.clue1?.trim() || ""}
      >
        {player.clue1?.trim() ? player.clue1 : "――"}
      </Box>

      {/* 数字（右揃え + tabular-nums） */}
      <Box
        textAlign="right"
        justifySelf="end"
        w="100%"
        fontSize={{ base: "15px", md: "17px" }}
        fontWeight={700}
        color="rgba(255,255,255,0.96)"
        textShadow="1px 1px 0 rgba(0,0,0,0.7)"
        pr={{ base: "8px", md: "12px" }}
        fontVariantNumeric="tabular-nums"
      >
        {typeof player.number === "number" ? player.number : "?"}
      </Box>

      {/* MVP / 投票統合列 */}
      <Flex
        justify="center"
        align="center"
        justifySelf="center"
        w={voteControlWidth}
        gap="4px"
        minH="28px"
      >
        {mvpStats.allVoted ? (
          <>
            {isMvp && (
              <Text
                as="span"
                fontSize={{ base: "16px", md: "18px" }}
                role="img"
                aria-hidden="true"
              >
                {mvpStats.isAllTie ? "🌟" : mvpStats.isTie ? "✨" : "🏆"}
              </Text>
            )}
            <Text
              as="span"
              fontSize={{ base: "13px", md: "14px" }}
              fontWeight={700}
              color={mvpColor}
              textShadow="1px 1px 0 rgba(0,0,0,0.7)"
            >
              ★{voteCount}
            </Text>
          </>
        ) : isSelf ? (
          <Text fontSize={{ base: "10px", md: "11px" }} opacity={0.5}>
            ―
          </Text>
        ) : mvpStats.myVote ? (
          mvpStats.myVote === player.id ? (
            <Box
              fontSize={{ base: "18px", md: "20px" }}
              fontWeight={900}
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              w={{ base: "28px", md: "32px" }}
              h={{ base: "28px", md: "32px" }}
              bg="rgba(255,215,0,0.22)"
              border="2px solid rgba(255,215,0,0.75)"
              borderRadius="0"
              color="#FFD700"
              textShadow="0 1px 2px rgba(0,0,0,0.7)"
              boxShadow="inset 0 1px 0 rgba(255,255,255,0.12), 0 0 8px rgba(255,215,0,0.35)"
            >
              ✓
            </Box>
          ) : (
            <Text
              fontSize={{ base: "10px", md: "11px" }}
              color="rgba(255,255,255,0.3)"
              fontWeight={700}
            >
              ―
            </Text>
          )
        ) : readOnly ? (
          <Text
            fontSize={{ base: "10px", md: "11px" }}
            color="rgba(255,255,255,0.45)"
            fontWeight={700}
          >
            閲覧のみ
          </Text>
        ) : (
          <Button
            size="xs"
            variant="ghost"
            border="2px solid rgba(255,255,255,0.72)"
            borderRadius="0"
            px={{ base: "11px", md: "14px" }}
            py={{ base: "5px", md: "6px" }}
            minH={{ base: "28px", md: "32px" }}
            h="auto"
            w="auto"
            fontSize={{ base: "9px", md: "10px" }}
            letterSpacing="0.03em"
            fontWeight={700}
            color="rgba(255,255,255,0.95)"
            bg="transparent"
            textShadow="1px 1px 0 rgba(0,0,0,0.6)"
            onClick={() => onVote(player.id)}
            loading={pendingTarget === player.id}
            transition="180ms cubic-bezier(.2,1,.3,1)"
            _hover={{
              bg: "rgba(255,255,255,0.15)",
              transform: "translateY(-1px)",
              borderColor: "rgba(255,255,255,0.88)",
              boxShadow:
                "inset 0 0 12px rgba(255,255,255,0.22), 0 0 8px rgba(255,255,255,0.18)",
            }}
            _active={{
              bg: "rgba(255,255,255,0.25)",
              transform: "translateY(1px)",
              boxShadow: "inset 0 2px 6px rgba(0,0,0,0.35)",
            }}
          >
            投票
          </Button>
        )}
      </Flex>
    </Box>
  );
}

