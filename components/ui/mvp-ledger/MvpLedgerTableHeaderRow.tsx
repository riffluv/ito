"use client";

import { Box, Flex } from "@chakra-ui/react";

type ResponsiveString = Readonly<{ base: string; md: string }>;

type MvpLedgerTableHeaderRowProps = {
  columnTemplate: ResponsiveString;
  voteControlWidth: ResponsiveString;
};

export function MvpLedgerTableHeaderRow({
  columnTemplate,
  voteControlWidth,
}: MvpLedgerTableHeaderRowProps) {
  return (
    <Box
      display="grid"
      gridTemplateColumns={columnTemplate}
      gap={{ base: "7px", md: "11px" }}
      px={{ base: "11px", md: "15px" }}
      pb="11px"
      borderBottom="2px solid rgba(255,255,255,0.85)"
      alignItems="center"
    >
      <Flex
        justify="center"
        align="center"
        justifySelf="center"
        fontSize={{ base: "13px", md: "15px" }}
        fontWeight={700}
        letterSpacing="0.03em"
        color="rgba(255,255,255,0.95)"
        textShadow="1px 1px 0 rgba(0,0,0,0.7)"
      >
        NO
      </Flex>
      <Flex
        justify="center"
        align="center"
        justifySelf="center"
        fontSize={{ base: "13px", md: "15px" }}
        fontWeight={700}
        letterSpacing="0.03em"
        color="rgba(255,255,255,0.95)"
        textShadow="1px 1px 0 rgba(0,0,0,0.7)"
      >
        {/* アバター */}
      </Flex>
      <Box
        textAlign="left"
        justifySelf="start"
        w="100%"
        fontSize={{ base: "13px", md: "15px" }}
        fontWeight={700}
        letterSpacing="0.03em"
        color="rgba(255,255,255,0.95)"
        textShadow="1px 1px 0 rgba(0,0,0,0.7)"
      >
        なかま
      </Box>
      <Box
        textAlign="left"
        justifySelf="start"
        w="100%"
        fontSize={{ base: "13px", md: "15px" }}
        fontWeight={700}
        letterSpacing="0.03em"
        color="rgba(255,255,255,0.95)"
        textShadow="1px 1px 0 rgba(0,0,0,0.7)"
      >
        連想語
      </Box>
      <Box
        textAlign="right"
        justifySelf="end"
        w="100%"
        fontSize={{ base: "13px", md: "15px" }}
        fontWeight={700}
        letterSpacing="0.03em"
        color="rgba(255,255,255,0.95)"
        textShadow="1px 1px 0 rgba(0,0,0,0.7)"
        pr={{ base: "8px", md: "12px" }}
      >
        数字
      </Box>
      <Flex
        justify="center"
        align="center"
        justifySelf="center"
        w={voteControlWidth}
        fontSize={{ base: "13px", md: "15px" }}
        fontWeight={700}
        letterSpacing="0.03em"
        color="rgba(255,255,255,0.95)"
        textShadow="1px 1px 0 rgba(0,0,0,0.7)"
      >
        MVP
      </Flex>
    </Box>
  );
}

