"use client";

import { Box, CloseButton, Flex, Image, Text } from "@chakra-ui/react";
import {
  BattleRecordStatsBadge,
  type LedgerStatsSummary,
} from "@/components/ui/mvp-ledger/mvpLedgerStats";

type MvpLedgerHeaderProps = {
  failed?: boolean;
  topic?: string | null;
  contextLabel?: string | null;
  statsSummary: LedgerStatsSummary;
  onCloseClick: () => void;
};

export function MvpLedgerHeader({
  failed,
  topic,
  contextLabel,
  statsSummary,
  onCloseClick,
}: MvpLedgerHeaderProps) {
  return (
    <Flex
      justify="space-between"
      align="center"
      px={{ base: "19px", md: "27px" }}
      py={{ base: "11px", md: "14px" }}
      borderBottom="none"
      position="relative"
      zIndex={20}
      bg="transparent"
    >
      <Flex align="center" gap={{ base: "11px", md: "15px" }}>
        <Image
          src="/images/hanepen1.webp"
          alt="pen"
          w={{ base: "32px", md: "38px" }}
          h={{ base: "32px", md: "38px" }}
          objectFit="contain"
          filter="drop-shadow(1px 1px 2px rgba(0,0,0,0.8))"
        />
        <Box>
          <Text
            fontSize={{ base: "19px", md: "23px" }}
            letterSpacing="0.12em"
            textShadow="2px 2px 0 rgba(0,0,0,0.8)"
            fontWeight={700}
          >
            {failed ? "BATTLE REPORT" : "PARTY RECORDS"}
          </Text>
          <Text
            fontSize={{ base: "11px", md: "12px" }}
            letterSpacing="0.05em"
            mt="5px"
            textShadow="1px 1px 0 rgba(0,0,0,0.6)"
            opacity={0.88}
          >
            {failed ? "［敗北］" : "［勝利］"}
            {topic ? ` お題: ${topic}` : ""}
          </Text>
          {contextLabel ? (
            <Text
              fontSize={{ base: "11px", md: "12px" }}
              letterSpacing="0.05em"
              mt="3px"
              color="rgba(255,255,255,0.82)"
              textShadow="1px 1px 0 rgba(0,0,0,0.6)"
            >
              {contextLabel}
            </Text>
          ) : null}
        </Box>
      </Flex>
      <Flex align="center" gap={{ base: "10px", md: "14px" }} justify="flex-end">
        <BattleRecordStatsBadge summary={statsSummary} />
        <CloseButton
          aria-label="閉じる"
          variant="ghost"
          size="lg"
          color="white"
          minW="40px"
          minH="40px"
          transition="180ms cubic-bezier(.2,1,.3,1)"
          _hover={{
            bg: "rgba(255,255,255,0.15)",
            transform: "translateY(-1px)",
          }}
          _active={{
            bg: "rgba(255,255,255,0.25)",
            transform: "translateY(1px)",
          }}
          onClick={onCloseClick}
        />
      </Flex>
    </Flex>
  );
}

