"use client";

import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import type { PlayerDoc, RoomStats } from "@/lib/types";
import {
  Box,
  Button,
  Flex,
  CloseButton,
  Portal,
  Stack,
  Text,
  useBreakpointValue,
  Image,
} from "@chakra-ui/react";
import { gsap } from "gsap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notify } from "@/components/ui/notify";
import { castMvpVote } from "@/lib/game/mvp";
import { usePixiHudLayer, usePixiHudContext } from "@/components/ui/pixi/PixiHudStage";
import { usePixiLayerLayout } from "@/components/ui/pixi/usePixiLayerLayout";
import PIXI from "@/lib/pixi/instance";
import { drawBattleRecordsBoard, createBattleRecordsAmbient } from "@/lib/pixi/battleRecordsBackground";
import type { BattleRecordsAmbient } from "@/lib/pixi/battleRecordsAmbient";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";

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
  stats: RoomStats | null;
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
  stats,
}: MvpLedgerProps) {
  const prefersReduced = useReducedMotionPreference();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<HTMLDivElement[]>([]);

  // Pixi HUD レイヤー（モーダル背景用）
  const pixiContainer = usePixiHudLayer("battle-records-board", {
    zIndex: 90,
  });
  const pixiHudContext = usePixiHudContext();
  const pixiGraphicsRef = useRef<PIXI.Graphics | null>(null);
  const ambientRef = useRef<BattleRecordsAmbient | null>(null);
  const [panelReady, setPanelReady] = useState(false);
  const fallbackPanel = !panelReady;

  const sortedPlayers = useMemo(() => {
    const lookup = new Map(players.map((p) => [p.id, p]));
    const ordered = orderList
      .map((id) => lookup.get(id))
      .filter((p): p is LedgerPlayer => Boolean(p));
    const leftovers = players.filter((p) => !orderList.includes(p.id));
    return [...ordered, ...leftovers];
  }, [players, orderList]);

  const validTargets = useMemo(
    () => new Set(sortedPlayers.map((p) => p.id)),
    [sortedPlayers]
  );

  // MVP投票の集計
  const mvpStats = useMemo(() => {
    const votes = mvpVotes || {};
    const voteCounts: Record<string, number> = {};

    // オンライン中のプレイヤーIDのSet
    const onlinePlayerIds = new Set(sortedPlayers.map((p) => p.id));

    // 投票済み判定: オンラインで投票した人（投票先が落ちててもOK）
    const voters = Object.keys(votes).filter((voterId) =>
      onlinePlayerIds.has(voterId)
    );

    // 有効票の集計: 投票者も投票先もオンライン
    const validVotes = Object.entries(votes).filter(
      ([voterId, votedId]) =>
        onlinePlayerIds.has(voterId) && onlinePlayerIds.has(votedId)
    );

    // 有効な投票のみをカウント
    validVotes.forEach(([_, votedId]) => {
      voteCounts[votedId] = (voteCounts[votedId] || 0) + 1;
    });

    const allVoted =
      sortedPlayers.length > 0 && sortedPlayers.every((p) => voters.includes(p.id));

    let mvpIds: string[] = [];
    let isTie = false;
    let isAllTie = false;
    if (allVoted) {
      const maxVotes = Math.max(...Object.values(voteCounts), 0);

      if (maxVotes > 0) {
        // 最多得票者を全員取得
        mvpIds = sortedPlayers
          .filter((p) => (voteCounts[p.id] || 0) === maxVotes)
          .map((p) => p.id);

        // 2人以上いたら同点
        isTie = mvpIds.length > 1;

        // 全員が同点かチェック
        isAllTie = mvpIds.length === sortedPlayers.length;
      }
    }

    return {
      voteCounts,
      totalVoters: voters.length,
      totalPlayers: sortedPlayers.length,
      allVoted,
      mvpIds,
      isTie,
      isAllTie,
      myVote: onlinePlayerIds.has(myId) ? (votes[myId] || null) : null,
    };
  }, [mvpVotes, sortedPlayers, myId]);

  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const playLedgerClose = useSoundEffect("ledger_close");
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const voteProgress =
    mvpStats.totalPlayers > 0
      ? Math.min(
          Math.max(mvpStats.totalVoters / mvpStats.totalPlayers, 0),
          1
        )
      : 0;
  const voteProgressPercent = Math.round(voteProgress * 100);
  const statsSummary = useMemo(() => buildLedgerStatsSummary(stats), [stats]);

  const handleVote = useCallback(
    async (votedPlayerId: string) => {
      if (!votedPlayerId || votedPlayerId === myId) return; // 自分には投票できない
      if (pendingTarget) return; // 多重送信ガード
      if (!validTargets.has(votedPlayerId)) return;
      if (mvpStats.myVote) return; // すでに投票済みなら何もしない

      setPendingTarget(votedPlayerId);
      try {
        await castMvpVote(roomId, myId, votedPlayerId);

        const playerName = sortedPlayers.find(p => p.id === votedPlayerId)?.name;
        notify({
          id: `mvp-vote-success:${roomId}`,
          title: "MVP投票完了",
          description: `${playerName || "このプレイヤー"} に投票しました`,
          type: "success",
        });
      } catch (error) {
        console.error("MVP投票エラー:", error);
        notify({
          id: `mvp-vote-error:${roomId}`,
          title: "MVP投票に失敗しました",
          description: "通信状態を確認して再度お試しください。",
          type: "error",
        });
      } finally {
        setPendingTarget(null);
      }
    },
    [myId, roomId, mvpStats.myVote, pendingTarget, validTargets, sortedPlayers]
  );

  const handleCloseClick = useCallback(() => {
    if (isClosing) return; // クールダウン中は何もしない

    playLedgerClose();

    const button = closeButtonRef.current;
    if (button && !prefersReduced) {
      setIsClosing(true);

      // ハイライト流れアニメーション
      const highlight = document.createElement("div");
      highlight.style.cssText = `
        position: absolute;
        top: 0;
        right: 100%;
        width: 50%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
        pointer-events: none;
      `;
      button.style.position = "relative";
      button.style.overflow = "hidden";
      button.appendChild(highlight);

      gsap.to(highlight, {
        right: "-50%",
        duration: 0.25,
        ease: "power2.out",
        onComplete: () => {
          highlight.remove();
        },
      });

      // クールダウン終了後に実際のクローズ処理
      setTimeout(() => {
        setIsClosing(false);
        onClose();
      }, 280);
    } else {
      onClose();
    }
  }, [isClosing, onClose, playLedgerClose, prefersReduced]);

  const handleOverlayClose = useCallback(() => {
    if (isClosing) return;
    playLedgerClose();
    onClose();
  }, [isClosing, onClose, playLedgerClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const overlay = overlayRef.current;
    const board = boardRef.current;
    if (!overlay || !board) return undefined;

    const rows = rowRefs.current.filter(Boolean);

    if (prefersReduced) {
      gsap.set(overlay, { opacity: 1 });
      gsap.set(board, { opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 });
      rows.forEach((row) => gsap.set(row, { opacity: 1, y: 0 }));
      return undefined;
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
      setPanelReady(false);
    }
  }, [isOpen]);

  // Pixi コンテナが取れない場合やリセット時は即フォールバックを有効化
  useEffect(() => {
    if (!pixiContainer) {
      setPanelReady(false);
    }
  }, [pixiContainer]);

  // WebGL コンテキスト喪失時は一旦フォールバックさせる（再描画で復帰）
  useEffect(() => {
    const handlePixiContext = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.status === "lost" || detail?.status === "restarting") {
        setPanelReady(false);
      }
    };
    window.addEventListener("ito:pixi-context", handlePixiContext as EventListener);
    return () => {
      window.removeEventListener("ito:pixi-context", handlePixiContext as EventListener);
    };
  }, []);

  // Escキー対応
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleCloseClick();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleCloseClick]);

  // Pixi背景の描画とDOM同期
  useEffect(() => {
    if (!isOpen || !pixiContainer) {
      // モーダルが閉じられたらPixiリソースを破棄
      if (pixiGraphicsRef.current) {
        if (pixiGraphicsRef.current.parent) {
          pixiGraphicsRef.current.parent.removeChild(pixiGraphicsRef.current);
        }
        pixiGraphicsRef.current.destroy({ children: true });
        pixiGraphicsRef.current = null;
      }
      if (ambientRef.current) {
        if (ambientRef.current.parent) {
          ambientRef.current.parent.removeChild(ambientRef.current);
        }
        ambientRef.current.destroy({ children: true });
        ambientRef.current = null;
      }
      setPanelReady(false);
      if (pixiHudContext?.renderOnce) {
        void pixiHudContext.renderOnce("mvpLedger:cleanup");
      }
      return undefined;
    }

    // Graphicsオブジェクトを作成（背景パネル）
    const graphics = new PIXI.Graphics();
    graphics.zIndex = -10; // 最背面に配置
    pixiContainer.addChild(graphics);
    pixiGraphicsRef.current = graphics;

    // クリーンアップ
    return () => {
      if (pixiGraphicsRef.current) {
        if (pixiGraphicsRef.current.parent) {
          pixiGraphicsRef.current.parent.removeChild(pixiGraphicsRef.current);
        }
        pixiGraphicsRef.current.destroy({ children: true });
        pixiGraphicsRef.current = null;
      }
      if (ambientRef.current) {
        if (ambientRef.current.parent) {
          ambientRef.current.parent.removeChild(ambientRef.current);
        }
        ambientRef.current.destroy({ children: true });
        ambientRef.current = null;
      }
      setPanelReady(false);
    };
  }, [isOpen, pixiContainer, pixiHudContext]);

  // DOM要素とPixiコンテナの位置・サイズ同期
  usePixiLayerLayout(boardRef, pixiContainer, {
    disabled: !isOpen || !pixiContainer,
    onUpdate: (layout) => {
      const graphics = pixiGraphicsRef.current;
      if (!graphics || layout.width <= 0 || layout.height <= 0) {
        setPanelReady(false);
        return;
      }

      // 非同期処理を独立した関数として実行（完了を待つため）
      const warmupAndReady = async () => {
        try {
          // 【重要】PixiHudStage の初期化完了を確実に待つ（スマホ環境で必須）
          if (pixiHudContext?.waitForHudReady) {
            const app = await pixiHudContext.waitForHudReady();
            if (!app) {
              console.error("[MvpLedger] PixiHudStage initialization failed");
              setPanelReady(false);
              return;
            }
            // 初回アクセス時に ticker が停止しているケースを救済
            if (app.ticker && !app.ticker.started) {
              app.ticker.start();
            }
          }

          graphics.clear();
          graphics.position.set(layout.x, layout.y);
          drawBattleRecordsBoard(PIXI, graphics, {
            width: layout.width,
            height: layout.height,
            dpr: layout.dpr,
            failed,
          });

          // アンビエント効果の作成・更新
          if (!ambientRef.current && pixiContainer) {
            // 初回作成
            const ambient = createBattleRecordsAmbient({
              width: layout.width,
              height: layout.height,
              failed,
            });
            ambient.position.set(layout.x, layout.y);
            ambient.zIndex = -8; // 背景パネルの上、DOM要素の下
            pixiContainer.addChild(ambient);
            ambientRef.current = ambient;
          } else if (ambientRef.current) {
            // リサイズ対応
            ambientRef.current.resize(layout.width, layout.height);
            ambientRef.current.position.set(layout.x, layout.y);
          }

          // グラボなし端末対策: Graphics描画直後に初回レンダリングを確実に実行してGPUを準備
          if (pixiHudContext?.renderOnce) {
            await pixiHudContext.renderOnce("mvpLedger:draw");

            // もう1フレーム待って確実にGPU処理を完了させる
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  resolve();
                });
              });
            });
          }

          // GPUウォームアップ完了後にアニメーションを開始
          ambientRef.current?.initialize?.();

          setPanelReady(true);
        } catch (error) {
          console.error("[MvpLedger] failed to draw Pixi battle records panel", error);
          setPanelReady(false);
        }
      };

      // 非同期処理を実行（エラーハンドリング付き）
      warmupAndReady().catch((error) => {
        console.error("[MvpLedger] warmup failed", error);
        setPanelReady(false);
      });
    },
  });

  const wrapperMarginTop = useBreakpointValue({ base: "12vh", md: "10vh" });
  const columnTemplate = {
    base: "50px 64px minmax(0, 1.65fr) minmax(0, 2.5fr) 88px 108px",
    md: "62px 74px minmax(0, 1.75fr) minmax(0, 2.7fr) 100px 132px",
  } as const;

  const voteControlWidth = {
    base: "56px",
    md: "64px",
  } as const;

  if (!isOpen) return null;

  return (
    <Portal>
      <Box
        ref={overlayRef}
        position="fixed"
        inset={0}
        zIndex={100}
        bg="rgba(8, 9, 15, 0.88)"
        backdropFilter="blur(6px)"
        onClick={handleOverlayClose}
      />
      <Flex
        position="fixed"
        inset={0}
        zIndex={120}
        justify="center"
        align="flex-start"
        pointerEvents="none"
      >
        <Flex
          ref={boardRef}
          data-pixi-target="battle-records-board"
          role="dialog"
          aria-modal
          aria-label="連想記録簿"
          direction="column"
          maxW={{ base: "95vw", md: "min(1000px, 88vw)" }}
          maxH={{ base: "92vh", md: "88vh" }}
          w="100%"
          mt={wrapperMarginTop}
          bg={
            fallbackPanel
              ? "linear-gradient(180deg, rgba(8,9,15,0.94) 0%, rgba(9,11,18,0.9) 100%)"
              : "transparent"
          }
          border={fallbackPanel ? "3px solid rgba(255,255,255,0.92)" : "none"}
          boxShadow={
            fallbackPanel
              ? "0 12px 38px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.4)"
              : "none"
          }
          transformOrigin="center"
          color="white"
          fontFamily="monospace"
          overflow="hidden"
          position="relative"
          pointerEvents="auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー */}
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
              </Box>
            </Flex>
            <Flex
              align="center"
              gap={{ base: "10px", md: "14px" }}
              justify="flex-end"
            >
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
                onClick={handleCloseClick}
              />
            </Flex>
          </Flex>

          {/* 表部分 - CSS Grid使用 */}
          <Box
            px={{ base: "19px", md: "27px" }}
            py={{ base: "12px", md: "16px" }}
            position="relative"
            zIndex={20}
            flex="1"
            overflow="hidden"
            display="flex"
            flexDirection="column"
          >
            {/* Grid定義 */}
            <Box
              display="grid"
              gridTemplateColumns={columnTemplate}
              gap={{ base: "7px", md: "11px" }}
              px={{ base: "11px", md: "15px" }}
              pb="11px"
              borderBottom="2px solid rgba(255,255,255,0.85)"
              alignItems="center"
            >
              <Flex justify="center" align="center" justifySelf="center" fontSize={{ base: "13px", md: "15px" }} fontWeight={700} letterSpacing="0.03em" color="rgba(255,255,255,0.95)" textShadow="1px 1px 0 rgba(0,0,0,0.7)">NO</Flex>
              <Flex justify="center" align="center" justifySelf="center" fontSize={{ base: "13px", md: "15px" }} fontWeight={700} letterSpacing="0.03em" color="rgba(255,255,255,0.95)" textShadow="1px 1px 0 rgba(0,0,0,0.7)">{/* アバター */}</Flex>
              <Box textAlign="left" justifySelf="start" w="100%" fontSize={{ base: "13px", md: "15px" }} fontWeight={700} letterSpacing="0.03em" color="rgba(255,255,255,0.95)" textShadow="1px 1px 0 rgba(0,0,0,0.7)">なかま</Box>
              <Box textAlign="left" justifySelf="start" w="100%" fontSize={{ base: "13px", md: "15px" }} fontWeight={700} letterSpacing="0.03em" color="rgba(255,255,255,0.95)" textShadow="1px 1px 0 rgba(0,0,0,0.7)">連想語</Box>
              <Box textAlign="right" justifySelf="end" w="100%" fontSize={{ base: "13px", md: "15px" }} fontWeight={700} letterSpacing="0.03em" color="rgba(255,255,255,0.95)" textShadow="1px 1px 0 rgba(0,0,0,0.7)" pr={{ base: "8px", md: "12px" }}>数字</Box>
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

            {/* 表データ */}
            <Box
              mt="9px"
              flex="1"
              overflowY="auto"
              pr={{ base: "3px", md: "6px" }}
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
              <Stack gap={{ base: "0", md: "0" }}>
                {sortedPlayers.map((player, index) => (
                  <Box
                    key={player.id}
                    ref={(el: HTMLDivElement | null) => {
                      if (el) rowRefs.current[index] = el;
                    }}
                    display="grid"
                    gridTemplateColumns={columnTemplate}
                    gap={{ base: "7px", md: "11px" }}
                    alignItems="center"
                    bg={
                      mvpStats.allVoted && mvpStats.mvpIds.includes(player.id)
                        ? mvpStats.isAllTie
                          ? "linear-gradient(135deg, rgba(59,130,246,0.27), rgba(37,99,235,0.21))"
                          : mvpStats.isTie
                          ? "linear-gradient(135deg, rgba(34,197,94,0.26), rgba(22,163,74,0.19))"
                          : "linear-gradient(135deg, rgba(255,215,0,0.28), rgba(255,165,0,0.22))"
                        : "transparent"
                    }
                    borderRadius="0"
                    px={{ base: "11px", md: "15px" }}
                    py={{ base: "11px", md: "13px" }}
                    borderBottom="1px solid rgba(255,255,255,0.08)"
                    border={
                      mvpStats.allVoted && mvpStats.mvpIds.includes(player.id)
                        ? mvpStats.isAllTie
                          ? "2px solid rgba(59,130,246,0.88)"
                          : mvpStats.isTie
                          ? "2px solid rgba(34,197,94,0.82)"
                          : "2px solid rgba(255,215,0,0.85)"
                        : "2px solid transparent"
                    }
                    boxShadow={[
                      "inset 0 -1px 0 rgba(0,0,0,0.15)",
                      mvpStats.allVoted && mvpStats.mvpIds.includes(player.id)
                        ? mvpStats.isAllTie
                          ? "0 0 19px rgba(59,130,246,0.52), inset 0 1px 0 rgba(255,255,255,0.16)"
                          : mvpStats.isTie
                          ? "0 0 17px rgba(34,197,94,0.48), inset 0 1px 0 rgba(255,255,255,0.14)"
                          : "0 0 18px rgba(255,215,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    position="relative"
                    _hover={{
                      bg: mvpStats.allVoted && mvpStats.mvpIds.includes(player.id)
                        ? mvpStats.isAllTie
                          ? "linear-gradient(135deg, rgba(59,130,246,0.33), rgba(37,99,235,0.27))"
                          : mvpStats.isTie
                          ? "linear-gradient(135deg, rgba(34,197,94,0.31), rgba(22,163,74,0.24))"
                          : "linear-gradient(135deg, rgba(255,215,0,0.32), rgba(255,165,0,0.26))"
                        : "rgba(255,255,255,0.05)",
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
                    <Flex
                      justify="center"
                      align="center"
                      justifySelf="center"
                    >
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
                        // 全員投票完了後: MVP表示
                        <>
                          {mvpStats.mvpIds.includes(player.id) && (
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
                            color={
                              mvpStats.mvpIds.includes(player.id)
                                ? mvpStats.isAllTie
                                  ? "#3B82F6"
                                  : mvpStats.isTie
                                  ? "#22C55E"
                                  : "#FFD700"
                                : "white"
                            }
                            textShadow="1px 1px 0 rgba(0,0,0,0.7)"
                          >
                            ★{mvpStats.voteCounts[player.id] || 0}
                          </Text>
                        </>
                      ) : (
                        // 投票中: 投票ボタンまたは投票済み表示
                        <>
                          {player.id !== myId ? (
                            mvpStats.myVote ? (
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
                                onClick={() => handleVote(player.id)}
                                loading={pendingTarget === player.id}
                                transition="180ms cubic-bezier(.2,1,.3,1)"
                                _hover={{
                                  bg: "rgba(255,255,255,0.15)",
                                  transform: "translateY(-1px)",
                                  borderColor: "rgba(255,255,255,0.88)",
                                  boxShadow: "inset 0 0 12px rgba(255,255,255,0.22), 0 0 8px rgba(255,255,255,0.18)",
                                }}
                                _active={{
                                  bg: "rgba(255,255,255,0.25)",
                                  transform: "translateY(1px)",
                                  boxShadow: "inset 0 2px 6px rgba(0,0,0,0.35)",
                                }}
                              >
                                投票
                              </Button>
                            )
                          ) : (
                            <Text fontSize={{ base: "10px", md: "11px" }} opacity={0.5}>―</Text>
                          )}
                        </>
                      )}
                    </Flex>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>

          {/* フッター */}
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
                    <>
                      🌟 全員同点！ みんな最高！
                    </>
                  ) : mvpStats.isTie ? (
                    <>
                      ✨ 同点！{" "}
                      {mvpStats.mvpIds
                        .map(id => sortedPlayers.find(p => p.id === id)?.name)
                        .filter(Boolean)
                        .join(" & ")}{" "}
                      が同率トップ！
                    </>
                  ) : (
                    <>
                      {sortedPlayers.find(p => p.id === mvpStats.mvpIds[0])?.name ? (
                        <>🏆 {sortedPlayers.find(p => p.id === mvpStats.mvpIds[0])?.name} がMVPに選ばれました！</>
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
                opacity={
                  mvpStats.allVoted || mvpStats.totalPlayers <= 0 ? 0 : 1
                }
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
                onClick={handleCloseClick}
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
        </Flex>
      </Flex>
    </Portal>
  );
}

type LedgerStatsSummary = {
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

function buildLedgerStatsSummary(stats?: RoomStats | null): LedgerStatsSummary {
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
    gameCount > 0 || successCount > 0 || failureCount > 0 || currentStreak > 0 || bestStreak > 0;

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

function BattleRecordStatsBadge({ summary }: { summary: LedgerStatsSummary }) {
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
        <Flex
          align="center"
          gap={{ base: "9px", md: "12px" }}
        >
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
              <Text as="span" fontSize="11px" ml="4px" color="rgba(255,255,255,0.85)" textShadow="1px 1px 0 rgba(0,0,0,0.8)">
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
        <Text as="span" fontSize="11px" ml="4px" color="rgba(255,255,255,0.85)" textShadow="1px 1px 0 rgba(0,0,0,0.8)">
          {unit}
        </Text>
      </Text>
      <Text fontSize="9px" letterSpacing="0.02em" color="rgba(255,255,255,0.78)" textShadow="1px 1px 0 rgba(0,0,0,0.7)" mt="1px">
        {caption}
      </Text>
    </Box>
  );
}
