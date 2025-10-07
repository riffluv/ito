"use client";

import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import type { PlayerDoc } from "@/lib/types";
import {
  Box,
  Button,
  Flex,
  CloseButton,
  Portal,
  Stack,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import { gsap } from "gsap";
import { useEffect, useMemo, useRef } from "react";

interface LedgerPlayer extends PlayerDoc {
  id: string;
}

interface MvpLedgerProps {
  isOpen: boolean;
  onClose: () => void;
  players: LedgerPlayer[];
  orderList: string[];
  topic?: string | null;
  failed?: boolean;
}

export function MvpLedger({
  isOpen,
  onClose,
  players,
  orderList,
  topic,
  failed,
}: MvpLedgerProps) {
  const prefersReduced = useReducedMotionPreference();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<HTMLDivElement[]>([]);

  const sortedPlayers = useMemo(() => {
    const lookup = new Map(players.map((p) => [p.id, p]));
    const ordered = orderList
      .map((id) => lookup.get(id))
      .filter((p): p is LedgerPlayer => Boolean(p));
    const leftovers = players.filter((p) => !orderList.includes(p.id));
    return [...ordered, ...leftovers];
  }, [players, orderList]);

  useEffect(() => {
    if (!isOpen) return;
    const overlay = overlayRef.current;
    const board = boardRef.current;
    if (!overlay || !board) return;

    const rows = rowRefs.current.filter(Boolean);

    if (prefersReduced) {
      gsap.set(overlay, { opacity: 1 });
      gsap.set(board, { opacity: 1, y: 0, scale: 1 });
      rows.forEach((row) => gsap.set(row, { opacity: 1, y: 0 }));
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        overlay,
        { opacity: 0 },
        { opacity: 1, duration: 0.38, ease: "power2.out" }
      );
      gsap.fromTo(
        board,
        { opacity: 0, y: 32, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "cubic-bezier(.2,1,.3,1)" }
      );
      gsap.fromTo(
        rows,
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.42,
          ease: "cubic-bezier(.16,1.1,.3,1)",
          stagger: 0.05,
          delay: 0.12,
        }
      );
    }, board);
    return () => ctx.revert();
  }, [isOpen, prefersReduced]);

  useEffect(() => {
    if (!isOpen) {
      rowRefs.current = [];
    }
  }, [isOpen]);

  const headerFont = useBreakpointValue({ base: "18px", md: "21px" });
  const bodyFont = useBreakpointValue({ base: "15px", md: "16px" });
  const wrapperMarginTop = useBreakpointValue({ base: "12vh", md: "10vh" });

  if (!isOpen) return null;

  return (
    <Portal>
      <Box
        ref={overlayRef}
        position="fixed"
        inset={0}
        zIndex={120}
        bg="rgba(8, 6, 12, 0.78)"
        backdropFilter="blur(8px) saturate(120%)"
        onClick={onClose}
      >
        <Flex
          ref={boardRef}
          role="dialog"
          aria-modal
          aria-label="連想記録簿"
          direction="column"
          maxW={{ base: "92vw", md: "min(880px, 82vw)" }}
          maxH={{ base: "90vh", md: "86vh" }}
          mx="auto"
          mt={wrapperMarginTop}
          px={{ base: 6, md: 8 }}
          py={{ base: 6, md: 8 }}
          bg="radial-gradient(120% 120% at 50% 0%, #2b1f1a 0%, #1a1417 42%, #0f0c10 100%)"
          border="3px solid rgba(214,177,117,0.9)"
          boxShadow="0 28px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,245,225,0.25)"
          transformOrigin="center"
          color="white"
          fontFamily="'EB Garamond', 'Shippori Mincho', serif"
          overflow="hidden"
          position="relative"
          onClick={(e) => e.stopPropagation()}
        >
          <Box
            position="absolute"
            inset={0}
            opacity={0.22}
            backgroundImage="radial-gradient(circle at 20% 20%, rgba(255,234,191,0.18) 0, transparent 48%), radial-gradient(circle at 80% 12%, rgba(160,199,255,0.15) 0, transparent 52%)"
            pointerEvents="none"
          />
          <Flex justify="space-between" align="center" mb={4} position="relative" zIndex={1}>
            <Box>
              <Text fontSize={headerFont} letterSpacing="0.08em" textTransform="uppercase">
                旅団記録簿
              </Text>
              <Text fontSize="14px" opacity={0.78} letterSpacing="0.04em" mt={1}>
                {failed ? "敗北の章" : "勝利の章"}
                {topic ? ` ｜ 題目：${topic}` : ""}
              </Text>
            </Box>
            <CloseButton
              aria-label="閉じる"
              variant="ghost"
              color="rgba(255,238,205,0.9)"
              _hover={{ color: "rgba(255,246,224,1)" }}
              _active={{ color: "rgba(255,230,180,1)" }}
              onClick={onClose}
            />
          </Flex>

          <Box
            border="1px solid rgba(247,224,168,0.4)"
            borderRadius="8px"
            bg="linear-gradient(150deg, rgba(66,48,44,0.92) 0%, rgba(41,31,47,0.88) 100%)"
            boxShadow="inset 0 0 0 1px rgba(15,10,9,0.65)"
            px={{ base: 4, md: 6 }}
            py={{ base: 4, md: 5 }}
            position="relative"
            zIndex={1}
            overflow="hidden"
          >
            <Box
              position="absolute"
              insetX={{ base: 4, md: 6 }}
              top="52px"
              height="1px"
              bg="linear-gradient(90deg, rgba(255,238,205,0) 0%, rgba(255,238,205,0.6) 50%, rgba(255,238,205,0) 100%)"
              opacity={0.7}
              pointerEvents="none"
            />

            <Flex
              fontSize={bodyFont}
              fontWeight={600}
              letterSpacing="0.06em"
              textTransform="uppercase"
              color="rgba(255,241,211,0.8)"
              justify="space-between"
              gap={{ base: 3, md: 6 }}
              pb={3}
              borderBottom="1px solid rgba(255,241,211,0.16)"
            >
              <Text flex="0 0 58px">No.</Text>
              <Text flex="1">旅人</Text>
              <Text flex="2">連想語</Text>
              <Text flex="0 0 72px" textAlign="center">
                数字
              </Text>
              <Text flex="0 0 110px" textAlign="center">
                MVP 投票
              </Text>
            </Flex>

            <Box
              mt={4}
              maxH="min(52vh, 420px)"
              overflowY="auto"
              pr={{ base: 2, md: 3 }}
              css={{
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(214,177,117,0.65) transparent",
                "&::-webkit-scrollbar": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "linear-gradient(180deg, rgba(214,177,117,0.9), rgba(170,134,96,0.9))",
                  borderRadius: "3px",
                },
              }}
            >
              <Stack gap={{ base: 3, md: 3.5 }}>
                {sortedPlayers.map((player, index) => (
                  <Flex
                    key={player.id}
                    ref={(el) => {
                      if (el) rowRefs.current[index] = el;
                    }}
                    align="stretch"
                    gap={{ base: 3, md: 5 }}
                    bg="linear-gradient(90deg, rgba(74,56,46,0.85), rgba(52,40,54,0.82))"
                    border="1px solid rgba(207,174,120,0.45)"
                    boxShadow="0 1px 0 rgba(0,0,0,0.45)"
                    borderRadius="6px"
                    px={{ base: 3, md: 4 }}
                    py={{ base: 3, md: 3.5 }}
                    position="relative"
                    _before={{
                      content: "\"\"",
                      position: "absolute",
                      inset: 0,
                      borderRadius: "6px",
                      boxShadow: "inset 0 0 12px rgba(12,7,5,0.55)",
                      pointerEvents: "none",
                    }}
                  >
                    <Flex
                      align="center"
                      justify="center"
                      flex="0 0 58px"
                      fontSize={bodyFont}
                      fontWeight={700}
                      color="rgba(255,244,220,0.86)"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </Flex>
                    <Flex direction="column" flex="1" justify="center">
                      <Text fontSize={bodyFont} fontWeight={700} letterSpacing="0.04em">
                        {player.name || "(名無し)"}
                      </Text>
                    </Flex>
                    <Flex
                      flex="2"
                      align="center"
                      fontSize={bodyFont}
                      fontWeight={600}
                      color="rgba(255,244,220,0.92)"
                    >
                      {player.clue1?.trim() ? player.clue1 : "――"}
                    </Flex>
                    <Flex
                      flex="0 0 72px"
                      align="center"
                      justify="center"
                      fontSize={bodyFont}
                      fontWeight={700}
                      color="rgba(255,241,211,0.88)"
                    >
                      {typeof player.number === "number" ? player.number : "?"}
                    </Flex>
                    <Flex
                      flex="0 0 110px"
                      align="center"
                      justify="center"
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        border="1px solid rgba(214,177,117,0.55)"
                        borderRadius="20px"
                        px={4}
                        fontSize="13px"
                        letterSpacing="0.03em"
                        color="rgba(255,239,212,0.9)"
                        _hover={{
                          bg: "rgba(214,177,117,0.24)",
                          transform: "translateY(-1px)",
                        }}
                        _active={{
                          bg: "rgba(214,177,117,0.32)",
                          transform: "translateY(0)",
                        }}
                      >
                        賞賛
                      </Button>
                    </Flex>
                  </Flex>
                ))}
              </Stack>
            </Box>
          </Box>

          <Flex
            justify="space-between"
            align="center"
            mt={5}
            fontSize="13px"
            letterSpacing="0.03em"
            opacity={0.78}
            zIndex={1}
          >
            <Text>投票は一章ごとにリセットされます。</Text>
            <Button
              size="sm"
              variant="ghost"
              color="rgba(255,238,205,0.9)"
              border="1px solid rgba(214,177,117,0.6)"
              borderRadius="22px"
              px={5}
              onClick={onClose}
              _hover={{ bg: "rgba(214,177,117,0.2)" }}
              _active={{ bg: "rgba(214,177,117,0.28)" }}
            >
              次の章へ進む
            </Button>
          </Flex>
        </Flex>
      </Box>
    </Portal>
  );
}

