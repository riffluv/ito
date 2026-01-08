"use client";

import { Box, Button, Flex, Text } from "@chakra-ui/react";
import type { RefObject } from "react";
import type {
  LedgerPlayer,
  MvpTally,
} from "@/components/ui/mvp-ledger/mvpLedgerDerivations";

type MvpLedgerFooterProps = {
  mvpStats: MvpTally;
  sortedPlayers: LedgerPlayer[];
  voteProgressPercent: number;
  isClosing: boolean;
  closeButtonRef: RefObject<HTMLButtonElement>;
  onCloseClick: () => void;
};

export function MvpLedgerFooter({
  mvpStats,
  sortedPlayers,
  voteProgressPercent,
  isClosing,
  closeButtonRef,
  onCloseClick,
}: MvpLedgerFooterProps) {
  const tiedMvpNames = mvpStats.mvpIds
    .map((id) => sortedPlayers.find((player) => player.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .join(" & ");

  const topMvpName = mvpStats.mvpIds[0]
    ? sortedPlayers.find((player) => player.id === mvpStats.mvpIds[0])?.name
    : undefined;

  return (
    <Flex
      direction="column"
      gap="11px"
      px={{ base: "19px", md: "27px" }}
      py={{ base: "11px", md: "13px" }}
      borderTop="none"
      fontSize={{ base: "11px", md: "13px" }}
      letterSpacing="0.03em"
      bg="transparent"
      zIndex={20}
    >
      {/* MVP投票状況 */}
      <Box w="100%">
        <Text textShadow="1px 1px 0 rgba(0,0,0,0.6)" opacity={0.85} mb="7px">
          {mvpStats.allVoted ? (
            mvpStats.isAllTie ? (
              <>🌟 全員同点！ みんな最高！</>
            ) : mvpStats.isTie ? (
              <>✨ 同点！ {tiedMvpNames} が同率トップ！</>
            ) : (
              <>
                {topMvpName ? (
                  <>🏆 {topMvpName} がMVPに選ばれました！</>
                ) : (
                  <>👋 MVPは去っていきました...</>
                )}
              </>
            )
          ) : (
            <>
              MVP投票: {mvpStats.totalVoters}/{mvpStats.totalPlayers}人完了
              {mvpStats.totalPlayers > 0 && " ※全員投票でMVPが決定します"}
            </>
          )}
        </Text>
        <Box
          position="relative"
          h="5px"
          bg="rgba(0,0,0,0.35)"
          border="1px solid rgba(255,255,255,0.18)"
          overflow="hidden"
          opacity={mvpStats.allVoted || mvpStats.totalPlayers <= 0 ? 0 : 1}
          pointerEvents="none"
          transition="opacity 260ms ease"
          aria-hidden="true"
        >
          <Box
            position="absolute"
            top={0}
            left={0}
            h="100%"
            w={`${voteProgressPercent}%`}
            minW={voteProgressPercent > 0 ? "1%" : "0"}
            bg="linear-gradient(90deg, rgba(255,215,0,0.75), rgba(255,165,0,0.85))"
            transition="width 320ms cubic-bezier(.2,1,.3,1)"
            boxShadow="inset 0 1px 0 rgba(255,255,255,0.22), 0 0 8px rgba(255,215,0,0.45)"
          />
        </Box>
      </Box>

      {/* 次の冒険へボタン */}
      <Flex justify="flex-end" w="100%">
        <Button
          ref={closeButtonRef}
          size="sm"
          variant="ghost"
          color="white"
          border="3px solid rgba(255,255,255,0.9)"
          borderRadius="0"
          px={6}
          fontWeight={700}
          letterSpacing="0.05em"
          textShadow="1px 1px 0 rgba(0,0,0,0.6)"
          onClick={onCloseClick}
          disabled={isClosing}
          position="relative"
          overflow="hidden"
          transition="180ms cubic-bezier(.2,1,.3,1)"
          _hover={{
            bg: isClosing ? "transparent" : "rgba(255,255,255,0.15)",
            transform: isClosing ? "none" : "translateY(-1px)",
          }}
          _active={{
            bg: isClosing ? "transparent" : "rgba(255,255,255,0.25)",
            transform: isClosing ? "none" : "translateY(1px)",
          }}
          _disabled={{
            opacity: 1,
            cursor: "not-allowed",
          }}
          css={
            isClosing
              ? {
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background:
                      "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 10px, transparent 10px, transparent 20px)",
                    pointerEvents: "none",
                  },
                }
              : {}
          }
        >
          次の冒険へ ▶
        </Button>
      </Flex>
    </Flex>
  );
}

