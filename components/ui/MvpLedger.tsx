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
      gsap.set(board, { opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 });
      rows.forEach((row) => gsap.set(row, { opacity: 1, y: 0 }));
      return;
    }

    const ctx = gsap.context(() => {
      // オーバーレイ: パッと出る
      gsap.fromTo(
        overlay,
        { opacity: 0 },
        { opacity: 1, duration: 0.18, ease: "power2.in" }
      );

      // ボード: 右からスライドイン + 回転で定位置に！
      gsap.fromTo(
        board,
        {
          opacity: 0,
          x: 150,
          y: -20,
          scale: 0.88,
          rotation: 8
        },
        {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          duration: 0.52,
          ease: "back.out(1.8)",
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
          bg="radial-gradient(120% 120% at 50% 0%, #1e1410 0%, #12100f 42%, #08090f 100%)"
          border="3px solid rgba(214,177,117,0.9)"
          boxShadow="0 28px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,245,225,0.15) inset, 0 2px 0 rgba(255,245,225,0.25) inset, 0 0 32px rgba(214,177,117,0.25)"
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
          {/* 角装飾 - 左上 */}
          <Box
            position="absolute"
            top="18px"
            left="18px"
            width="22px"
            height="22px"
            borderLeft="3px solid rgba(214,177,117,0.85)"
            borderTop="3px solid rgba(214,177,117,0.85)"
            zIndex={2}
            pointerEvents="none"
            _before={{
              content: "\"\"",
              position: "absolute",
              top: "-6px",
              left: "-6px",
              width: "8px",
              height: "8px",
              bg: "rgba(214,177,117,0.9)",
              transform: "rotate(45deg)",
              boxShadow: "0 0 12px rgba(214,177,117,0.6)",
            }}
          />
          {/* 角装飾 - 右上 */}
          <Box
            position="absolute"
            top="18px"
            right="18px"
            width="22px"
            height="22px"
            borderRight="3px solid rgba(214,177,117,0.85)"
            borderTop="3px solid rgba(214,177,117,0.85)"
            zIndex={2}
            pointerEvents="none"
            _before={{
              content: "\"\"",
              position: "absolute",
              top: "-6px",
              right: "-6px",
              width: "8px",
              height: "8px",
              bg: "rgba(214,177,117,0.9)",
              transform: "rotate(45deg)",
              boxShadow: "0 0 12px rgba(214,177,117,0.6)",
            }}
          />
          {/* 角装飾 - 左下 */}
          <Box
            position="absolute"
            bottom="18px"
            left="18px"
            width="22px"
            height="22px"
            borderLeft="3px solid rgba(214,177,117,0.85)"
            borderBottom="3px solid rgba(214,177,117,0.85)"
            zIndex={2}
            pointerEvents="none"
            _before={{
              content: "\"\"",
              position: "absolute",
              bottom: "-6px",
              left: "-6px",
              width: "8px",
              height: "8px",
              bg: "rgba(214,177,117,0.9)",
              transform: "rotate(45deg)",
              boxShadow: "0 0 12px rgba(214,177,117,0.6)",
            }}
          />
          {/* 角装飾 - 右下 */}
          <Box
            position="absolute"
            bottom="18px"
            right="18px"
            width="22px"
            height="22px"
            borderRight="3px solid rgba(214,177,117,0.85)"
            borderBottom="3px solid rgba(214,177,117,0.85)"
            zIndex={2}
            pointerEvents="none"
            _before={{
              content: "\"\"",
              position: "absolute",
              bottom: "-6px",
              right: "-6px",
              width: "8px",
              height: "8px",
              bg: "rgba(214,177,117,0.9)",
              transform: "rotate(45deg)",
              boxShadow: "0 0 12px rgba(214,177,117,0.6)",
            }}
          />
          <Flex justify="space-between" align="center" mb={4} position="relative" zIndex={1}>
            <Box>
              <Text
                fontSize={headerFont}
                letterSpacing="0.08em"
                textTransform="uppercase"
                textShadow="2px 3px 0 rgba(0,0,0,0.65), 0 0 18px rgba(214,177,117,0.45)"
                fontWeight={700}
              >
                {failed ? "戦いの記録" : "冒険の記録"}
              </Text>
              <Text
                fontSize="14px"
                opacity={0.78}
                letterSpacing="0.04em"
                mt={1}
                textShadow="1px 1px 0 rgba(0,0,0,0.5)"
              >
                {failed ? "～ 敗北 ～" : "～ 勝利 ～"}
                {topic ? ` ｜ お題：${topic}` : ""}
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
            bg="linear-gradient(150deg, rgba(28,20,16,0.96) 0%, rgba(18,14,22,0.94) 100%)"
            boxShadow="inset 0 1px 0 rgba(214,177,117,0.15), inset 0 -2px 6px rgba(0,0,0,0.4)"
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
              fontWeight={700}
              letterSpacing="0.06em"
              color="rgba(255,241,211,0.92)"
              align="center"
              gap={{ base: 3, md: 4 }}
              pb={3}
              borderBottom="2px solid rgba(214,177,117,0.55)"
              position="relative"
              textShadow="1px 2px 0 rgba(0,0,0,0.6)"
              zIndex={1}
              px={{ base: 3, md: 4 }}
            >
              {/* アバター列スペーサー */}
              <Box w={{ base: "48px", md: "52px" }} flexShrink={0} />

              <Text flex="0 0 42px">NO.</Text>
              <Text flex="1" minW={0}>なかま</Text>
              <Text flex="2" minW={0}>連想語</Text>
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
                    align="center"
                    gap={{ base: 3, md: 4 }}
                    bg="linear-gradient(135deg, rgba(34,24,20,0.75) 0%, rgba(24,18,28,0.72) 100%)"
                    boxShadow="inset 0 1px 0 rgba(214,177,117,0.12)"
                    borderRadius="0"
                    px={{ base: 3, md: 4 }}
                    py={{ base: 3, md: 3.5 }}
                    position="relative"
                    _before={{
                      content: "\"\"",
                      position: "absolute",
                      left: "0",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "2px",
                      height: "50%",
                      bg: "linear-gradient(180deg, rgba(214,177,117,0.5), rgba(214,177,117,0.2))",
                      pointerEvents: "none",
                    }}
                  >
                    {/* アバター */}
                    <Box
                      w={{ base: "48px", md: "52px" }}
                      h={{ base: "48px", md: "52px" }}
                      flexShrink={0}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      position="relative"
                      css={{
                        clipPath:
                          "polygon(15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%, 0% 15%)",
                        "&::before": {
                          content: "''",
                          position: "absolute",
                          inset: "-2px",
                          background:
                            "linear-gradient(135deg, rgba(214,177,117,0.7) 0%, rgba(140,100,70,0.5) 50%, rgba(86,62,40,0.7) 100%)",
                          clipPath:
                            "polygon(15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%, 0% 15%)",
                          zIndex: -1,
                          filter: "blur(1px)",
                        },
                      }}
                    >
                      {player.avatar?.startsWith("/avatars/") ? (
                        <img
                          src={player.avatar}
                          alt={player.name || "avatar"}
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            filter:
                              "drop-shadow(0 2px 4px rgba(0,0,0,0.8)) contrast(1.15) saturate(1.1)",
                          }}
                        />
                      ) : (
                        <Text
                          fontSize={{ base: "2xl", md: "3xl" }}
                          filter="drop-shadow(0 2px 4px rgba(0,0,0,0.9))"
                          position="absolute"
                        >
                          {player.avatar || "⚔️"}
                        </Text>
                      )}
                    </Box>

                    {/* NO. */}
                    <Flex
                      align="center"
                      justify="center"
                      flex="0 0 42px"
                      fontSize={bodyFont}
                      fontWeight={700}
                      color="rgba(255,244,220,0.86)"
                      textShadow="1px 1px 0 rgba(0,0,0,0.65)"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </Flex>

                    {/* 名前 */}
                    <Flex direction="column" flex="1" justify="center" minW={0}>
                      <Text
                        fontSize={bodyFont}
                        fontWeight={700}
                        letterSpacing="0.04em"
                        textShadow="1px 1px 0 rgba(0,0,0,0.55)"
                        truncate
                      >
                        {player.name || "(名無し)"}
                      </Text>
                    </Flex>
                    <Flex
                      flex="2"
                      align="center"
                      fontSize={bodyFont}
                      fontWeight={600}
                      color="rgba(255,244,220,0.92)"
                      textShadow="1px 1px 0 rgba(0,0,0,0.5)"
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
                      textShadow="1px 1px 0 rgba(0,0,0,0.6)"
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
                        border="2px solid rgba(214,177,117,0.65)"
                        borderRadius="0"
                        px={4}
                        fontSize="13px"
                        letterSpacing="0.03em"
                        fontWeight={600}
                        color="rgba(255,239,212,0.9)"
                        textShadow="1px 1px 0 rgba(0,0,0,0.5)"
                        boxShadow="inset 0 1px 0 rgba(214,177,117,0.25), 0 2px 4px rgba(0,0,0,0.4)"
                        _hover={{
                          bg: "rgba(214,177,117,0.24)",
                          transform: "translateY(-1px)",
                          boxShadow: "inset 0 1px 0 rgba(214,177,117,0.35), 0 3px 6px rgba(0,0,0,0.5)",
                        }}
                        _active={{
                          bg: "rgba(214,177,117,0.32)",
                          transform: "translateY(1px)",
                          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4)",
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
            <Text textShadow="1px 1px 0 rgba(0,0,0,0.5)">
              投票は一章ごとにリセットされます。
            </Text>
            <Button
              size="sm"
              variant="ghost"
              color="rgba(255,238,205,0.9)"
              border="2px solid rgba(214,177,117,0.7)"
              borderRadius="0"
              px={5}
              fontWeight={600}
              textShadow="1px 1px 0 rgba(0,0,0,0.5)"
              boxShadow="inset 0 1px 0 rgba(214,177,117,0.3), 0 2px 6px rgba(0,0,0,0.5)"
              onClick={onClose}
              _hover={{
                bg: "rgba(214,177,117,0.2)",
                transform: "translateY(-1px)",
                boxShadow: "inset 0 1px 0 rgba(214,177,117,0.4), 0 3px 8px rgba(0,0,0,0.6)",
              }}
              _active={{
                bg: "rgba(214,177,117,0.28)",
                transform: "translateY(1px)",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4)",
              }}
            >
              次の冒険へ
            </Button>
          </Flex>
        </Flex>
      </Box>
    </Portal>
  );
}

