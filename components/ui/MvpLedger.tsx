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
  IconButton,
} from "@chakra-ui/react";
import { gsap } from "gsap";
import { useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase/client";
import { doc, updateDoc } from "firebase/firestore";

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
  roomId: string;
  myId: string;
  mvpVotes?: Record<string, string> | null;
}

export function MvpLedger({
  isOpen,
  onClose,
  players,
  orderList,
  topic,
  failed,
  roomId,
  myId,
  mvpVotes = null,
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

  // MVP投票の集計
  const mvpStats = useMemo(() => {
    const votes = mvpVotes || {};
    const voteCounts: Record<string, number> = {};
    const voters = Object.keys(votes);

    // 得票数カウント
    Object.values(votes).forEach((votedId) => {
      voteCounts[votedId] = (voteCounts[votedId] || 0) + 1;
    });

    // 全員投票したか
    const allVoted = sortedPlayers.length > 0 &&
                     sortedPlayers.every((p) => voters.includes(p.id));

    // MVP決定 (全員投票済みで最多得票)
    let mvpId: string | null = null;
    if (allVoted) {
      let maxVotes = 0;
      Object.entries(voteCounts).forEach(([playerId, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          mvpId = playerId;
        }
      });
    }

    return {
      voteCounts,
      totalVoters: voters.length,
      totalPlayers: sortedPlayers.length,
      allVoted,
      mvpId,
      myVote: votes[myId] || null,
    };
  }, [mvpVotes, sortedPlayers, myId]);

  // MVP投票関数
  const handleVote = async (votedPlayerId: string) => {
    if (!db || votedPlayerId === myId) return; // 自分には投票できない

    try {
      const roomRef = doc(db, "rooms", roomId);
      await updateDoc(roomRef, {
        [`mvpVotes.${myId}`]: votedPlayerId,
      });
    } catch (error) {
      console.error("MVP投票エラー:", error);
    }
  };

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
        bg="rgba(8, 9, 15, 0.88)"
        backdropFilter="blur(6px)"
        onClick={onClose}
      >
        <Flex
          ref={boardRef}
          role="dialog"
          aria-modal
          aria-label="連想記録簿"
          direction="column"
          maxW={{ base: "94vw", md: "min(920px, 86vw)" }}
          maxH={{ base: "92vh", md: "88vh" }}
          mx="auto"
          mt={wrapperMarginTop}
          bg="rgba(8, 9, 15, 0.95)"
          border="3px solid rgba(255,255,255,0.9)"
          boxShadow="0 0 0 1px rgba(0,0,0,0.8), 0 12px 48px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.12)"
          transformOrigin="center"
          color="white"
          fontFamily="monospace"
          overflow="hidden"
          position="relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <Flex
            justify="space-between"
            align="center"
            px={{ base: 5, md: 7 }}
            py={4}
            borderBottom="3px solid rgba(255,255,255,0.9)"
            position="relative"
            zIndex={1}
            bg="rgba(0,0,0,0.4)"
          >
            <Box>
              <Text
                fontSize={{ base: "20px", md: "24px" }}
                letterSpacing="0.1em"
                textShadow="2px 2px 0 rgba(0,0,0,0.8)"
                fontWeight={700}
              >
                {failed ? "▼ 戦いの記録 ▼" : "▲ 冒険の記録 ▲"}
              </Text>
              <Text
                fontSize="13px"
                letterSpacing="0.06em"
                mt={1}
                textShadow="1px 1px 0 rgba(0,0,0,0.6)"
                opacity={0.9}
              >
                {failed ? "［敗北］" : "［勝利］"}
                {topic ? ` お題: ${topic}` : ""}
              </Text>
            </Box>
            <CloseButton
              aria-label="閉じる"
              variant="ghost"
              size="lg"
              color="white"
              _hover={{ bg: "rgba(255,255,255,0.15)" }}
              _active={{ bg: "rgba(255,255,255,0.25)" }}
              onClick={onClose}
            />
          </Flex>

          {/* 表部分 - CSS Grid使用 */}
          <Box
            px={{ base: 5, md: 7 }}
            py={{ base: 4, md: 5 }}
            position="relative"
            zIndex={1}
            flex="1"
            overflow="hidden"
            display="flex"
            flexDirection="column"
          >
            {/* Grid定義 */}
            <Box
              display="grid"
              gridTemplateColumns={{
                base: "50px 50px 1fr 2fr 70px 80px 70px",
                md: "60px 60px 1.2fr 2fr 80px 90px 80px"
              }}
              gap={{ base: 2, md: 3 }}
              px={{ base: 3, md: 4 }}
              fontSize={{ base: "14px", md: "16px" }}
              fontWeight={700}
              letterSpacing="0.05em"
              color="white"
              pb={3}
              borderBottom="2px solid rgba(255,255,255,0.85)"
              textShadow="1px 1px 0 rgba(0,0,0,0.7)"
              alignItems="center"
            >
              <Box textAlign="center">NO</Box>
              <Box />
              <Box>なかま</Box>
              <Box>連想語</Box>
              <Box textAlign="center">数字</Box>
              <Box textAlign="center">MVP</Box>
              <Box textAlign="center">投票</Box>
            </Box>

            {/* 表データ */}
            <Box
              mt={3}
              flex="1"
              overflowY="auto"
              pr={{ base: 1, md: 2 }}
              css={{
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(255,255,255,0.6) transparent",
                "&::-webkit-scrollbar": {
                  width: "8px",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "rgba(255,255,255,0.6)",
                  borderRadius: "0",
                },
              }}
            >
              <Stack gap={{ base: 2, md: 2.5 }}>
                {sortedPlayers.map((player, index) => (
                  <Box
                    key={player.id}
                    ref={(el) => {
                      if (el) rowRefs.current[index] = el;
                    }}
                    display="grid"
                    gridTemplateColumns={{
                      base: "50px 50px 1fr 2fr 70px 80px 70px",
                      md: "60px 60px 1.2fr 2fr 80px 90px 80px"
                    }}
                    gap={{ base: 2, md: 3 }}
                    alignItems="center"
                    bg="rgba(0,0,0,0.3)"
                    borderRadius="0"
                    px={{ base: 3, md: 4 }}
                    py={{ base: 3, md: 3.5 }}
                    _hover={{
                      bg: "rgba(255,255,255,0.1)",
                    }}
                  >
                    {/* NO. */}
                    <Box
                      fontSize={{ base: "15px", md: "17px" }}
                      fontWeight={700}
                      textAlign="center"
                      textShadow="1px 1px 0 rgba(0,0,0,0.7)"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </Box>

                    {/* アバター */}
                    <Box
                      w={{ base: "44px", md: "52px" }}
                      h={{ base: "44px", md: "52px" }}
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
                          fontSize={{ base: "24px", md: "28px" }}
                          filter="drop-shadow(0 1px 2px rgba(0,0,0,0.8))"
                        >
                          {player.avatar || "⚔️"}
                        </Text>
                      )}
                    </Box>

                    {/* 名前 */}
                    <Box
                      fontSize={{ base: "15px", md: "16px" }}
                      fontWeight={700}
                      letterSpacing="0.03em"
                      textShadow="1px 1px 0 rgba(0,0,0,0.6)"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      {player.name || "(名無し)"}
                    </Box>

                    {/* 連想語 */}
                    <Box
                      fontSize={{ base: "14px", md: "15px" }}
                      fontWeight={600}
                      textShadow="1px 1px 0 rgba(0,0,0,0.5)"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      {player.clue1?.trim() ? player.clue1 : "――"}
                    </Box>

                    {/* 数字 */}
                    <Box
                      textAlign="center"
                      fontSize={{ base: "16px", md: "18px" }}
                      fontWeight={700}
                      textShadow="1px 1px 0 rgba(0,0,0,0.7)"
                    >
                      {typeof player.number === "number" ? player.number : "?"}
                    </Box>

                    {/* MVP得票数 */}
                    <Flex
                      align="center"
                      justify="center"
                      gap={1}
                    >
                      {mvpStats.mvpId === player.id && (
                        <Text fontSize={{ base: "14px", md: "16px" }}>🏆</Text>
                      )}
                      <Text
                        fontSize={{ base: "13px", md: "14px" }}
                        fontWeight={700}
                        color={mvpStats.voteCounts[player.id] > 0 ? "white" : "rgba(255,255,255,0.4)"}
                        textShadow="1px 1px 0 rgba(0,0,0,0.7)"
                      >
                        ★{mvpStats.voteCounts[player.id] || 0}
                      </Text>
                    </Flex>

                    {/* 投票ボタン */}
                    <Flex justify="center">
                      {player.id !== myId ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          border={mvpStats.myVote === player.id ? "2px solid white" : "2px solid rgba(255,255,255,0.5)"}
                          borderRadius="0"
                          px={{ base: 2, md: 3 }}
                          fontSize={{ base: "10px", md: "11px" }}
                          letterSpacing="0.02em"
                          fontWeight={700}
                          color="white"
                          bg={mvpStats.myVote === player.id ? "rgba(255,255,255,0.2)" : "transparent"}
                          textShadow="1px 1px 0 rgba(0,0,0,0.6)"
                          onClick={() => handleVote(player.id)}
                          _hover={{
                            bg: "rgba(255,255,255,0.15)",
                            transform: "translateY(-1px)",
                          }}
                          _active={{
                            bg: "rgba(255,255,255,0.25)",
                            transform: "translateY(0)",
                          }}
                        >
                          {mvpStats.myVote === player.id ? "✓" : "投票"}
                        </Button>
                      ) : (
                        <Text fontSize={{ base: "11px", md: "12px" }} opacity={0.5}>―</Text>
                      )}
                    </Flex>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>

          {/* フッター */}
          <Flex
            justify="space-between"
            align="center"
            px={{ base: 5, md: 7 }}
            py={4}
            borderTop="3px solid rgba(255,255,255,0.9)"
            fontSize={{ base: "12px", md: "13px" }}
            letterSpacing="0.03em"
            bg="rgba(0,0,0,0.4)"
            zIndex={1}
          >
            <Text textShadow="1px 1px 0 rgba(0,0,0,0.6)" opacity={0.85}>
              ※投票は各ラウンドでリセットされます
            </Text>
            <Button
              size="sm"
              variant="ghost"
              color="white"
              border="3px solid rgba(255,255,255,0.9)"
              borderRadius="0"
              px={6}
              fontWeight={700}
              letterSpacing="0.05em"
              textShadow="1px 1px 0 rgba(0,0,0,0.6)"
              onClick={onClose}
              _hover={{
                bg: "rgba(255,255,255,0.15)",
                transform: "translateY(-1px)",
              }}
              _active={{
                bg: "rgba(255,255,255,0.25)",
                transform: "translateY(1px)",
              }}
            >
              次の冒険へ ▶
            </Button>
          </Flex>
        </Flex>
      </Box>
    </Portal>
  );
}

