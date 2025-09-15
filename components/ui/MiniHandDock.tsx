"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
import { updateClue1 } from "@/lib/firebase/players";
import {
  canSubmitCard,
  computeAllSubmitted,
  isSortSubmit,
  normalizeResolveMode,
  ResolveMode,
} from "@/lib/game/resolveMode";
import {
  addCardToProposal,
  commitPlayFromClue,
  continueAfterFail as continueAfterFailAction,
  startGame as startGameAction,
  submitSortedOrder,
} from "@/lib/game/room";
import { resetRoomWithPrune } from "@/lib/firebase/rooms";
import { topicControls } from "@/lib/game/topicControls";
import { db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import type { PlayerDoc } from "@/lib/types";
import { Box, HStack, IconButton, Input, Dialog, Text, VStack } from "@chakra-ui/react";
import React from "react";
import { UI_TOKENS } from "@/theme/layout";
import { FaDice, FaRedo, FaRegCreditCard } from "react-icons/fa";
import { FiLogOut, FiSettings } from "react-icons/fi";
import { DiamondNumberCard } from "./DiamondNumberCard";
import { postRoundReset } from "@/lib/utils/broadcast";
import Tooltip from "@/components/ui/Tooltip";

interface MiniHandDockProps {
  roomId: string;
  me: (PlayerDoc & { id: string }) | undefined;
  resolveMode?: ResolveMode | null;
  proposal?: string[];
  eligibleIds?: string[];
  cluesReady?: boolean;
  isHost?: boolean;
  roomStatus?: string;
  defaultTopicType?: string;
  allowContinueAfterFail?: boolean;
  roomName?: string;
  onOpenSettings?: () => void;
  onLeaveRoom?: () => void | Promise<void>;
  pop?: boolean;
  // 在席者のみでリセットするための補助情報
  onlineUids?: string[];
  roundIds?: string[];
  // カスタムお題（現在値）
  currentTopic?: string | null;
}

export default function MiniHandDock(props: MiniHandDockProps) {
  const {
    roomId,
    me,
    resolveMode,
    proposal,
    eligibleIds,
    cluesReady,
    isHost,
    roomStatus,
    defaultTopicType = "通常版",
    allowContinueAfterFail,
    onOpenSettings,
    onLeaveRoom,
    pop = false,
    onlineUids,
    roundIds,
    currentTopic,
  } = props;

  const [text, setText] = React.useState<string>(me?.clue1 || "");
  React.useEffect(() => setText(me?.clue1 || ""), [me?.clue1]);

  const actualResolveMode = normalizeResolveMode(resolveMode);
  const placed = !!proposal?.includes(me?.id || "");
  const ready = !!(me && (me as any).ready === true);
  const canDecide =
    !!me?.id && typeof me?.number === "number" && text.trim().length > 0;
  const allSubmitted = computeAllSubmitted({
    mode: actualResolveMode,
    eligibleIds,
    proposal,
  });
  const canSubmit = canSubmitCard({
    mode: actualResolveMode,
    canDecide,
    ready,
    placed,
    cluesReady,
  });

  const handleDecide = async () => {
    if (!canDecide || !me?.id) return;

    try {
      await updateClue1(roomId, me.id, text.trim());
      notify({ title: "連想ワードを記録しました", type: "success" });
    } catch (e: any) {
      if (isFirebaseQuotaExceeded(e)) {
        handleFirebaseQuotaError("連想ワード記録");
        notify({
          title: "接続制限のため記録不可",
          description: "現在連想ワードを記録できません。24時間後に再度お試しください。",
          type: "error",
        });
      } else {
        notify({
          title: "記録に失敗しました",
          description: e?.message,
          type: "error",
        });
      }
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !me?.id) return;

    try {
      if (isSortSubmit(actualResolveMode)) {
        if (!placed) await addCardToProposal(roomId, me.id);
      } else {
        if (!cluesReady) return;
        await commitPlayFromClue(roomId, me.id);
      }
      notify({ title: "提出しました", type: "success" });
    } catch (e: any) {
      if (isFirebaseQuotaExceeded(e)) {
        handleFirebaseQuotaError("カード提出");
        notify({
          title: "🚨 Firebase読み取り制限",
          description: "現在カードを提出できません。24時間後に再度お試しください。",
          type: "error",
        });
      } else {
        notify({
          title: "提出に失敗しました",
          description: e?.message,
          type: "error",
        });
      }
    }
  };

  // カスタムお題モーダル制御
  const [customOpen, setCustomOpen] = React.useState(false);
  const [customStartPending, setCustomStartPending] = React.useState(false);
  const [customText, setCustomText] = React.useState<string>("");
  const handleSubmitCustom = async (val: string) => {
    const v = (val || "").trim();
    if (!v) return;
    await topicControls.setCustomTopic(roomId, v);
    setCustomOpen(false);
    if (customStartPending) {
      try {
        await topicControls.dealNumbers(roomId);
      } finally {
        setCustomStartPending(false);
      }
    }
  };

  const quickStart = async () => {
    // サーバのオプションだけを使用（最新値を明示取得して反映遅延を吸収）
    let effectiveType = defaultTopicType as string;
    try {
      if (db) {
        const snap = await getDoc(doc(db, "rooms", roomId));
        const latest = (snap.data() as any)?.options?.defaultTopicType as string | undefined;
        if (latest && typeof latest === "string") effectiveType = latest;
      }
    } catch {}

    if (effectiveType === "カスタム") {
      await startGameAction(roomId);
      // 画面側の楽観フラグは撤去（サーバ確定クリアに任せる）
      try { delete (window as any).__ITO_LAST_RESET; } catch {}
      if (!currentTopic || !String(currentTopic).trim()) {
        setCustomStartPending(true);
        setCustomText("");
        setCustomOpen(true);
        return;
      }
      await topicControls.dealNumbers(roomId);
      try { postRoundReset(roomId); } catch {}
      return;
    }
    await startGameAction(roomId);
    try { delete (window as any).__ITO_LAST_RESET; } catch {}
    await topicControls.selectCategory(roomId, effectiveType as any);
    await topicControls.dealNumbers(roomId);
    try { postRoundReset(roomId); } catch {}
  };

  const evalSorted = async () => {
    if (!allSubmitted) return;
    const list = (proposal || []).filter(
      (v): v is string => typeof v === "string" && v.length > 0
    );
    await submitSortedOrder(roomId, list);
  };

  const continueRound = async () => {
    await continueAfterFailAction(roomId);
    try { postRoundReset(roomId); } catch {}
  };

  const resetGame = async () => {
    try {
      // 在席者だけでやり直す（presenceのオンラインUIDを利用、追加読取なし）
      const keep = Array.isArray(roundIds) && Array.isArray(onlineUids)
        ? roundIds.filter((id) => onlineUids.includes(id))
        : (onlineUids || []);
      await resetRoomWithPrune(roomId, keep, { notifyChat: true });
      notify({ title: "ゲームをリセット！", type: "success" });
      try { postRoundReset(roomId); } catch {}
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      notify({ title: "リセットに失敗しました", description: msg, type: "error" });
    }
  };

  // 動的レイアウト: ホストは左寄せ、ゲストは中央寄せ
  const hasHostButtons = isHost && (
    (roomStatus === "waiting") ||
    (isSortSubmit(actualResolveMode) && roomStatus === "clue") ||
    ((roomStatus === "reveal" && !!allowContinueAfterFail) || roomStatus === "finished")
  );

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent={hasHostButtons ? "flex-start" : "center"}
      w="100%"
      maxW="1280px"
      mx="auto"
      px={{ base: 4, md: 6 }}
      py={{ base: 3, md: 4 }}
      gap={{ base: 3, md: 5 }}
      bg="rgba(20,23,34,0.90)" // パネル色を少し透過して背景となじませる
      border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha60}`}
      borderRadius={0}
      boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
      position="relative"
      _before={{
        content: '""',
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        background: UI_TOKENS.COLORS.whiteAlpha20, // 上フチだけを薄く出して“固定感”を演出
      }}
    >
      {/* Left cluster */}
      <HStack gap={{ base: 3, md: 4 }} align="center">
        <DiamondNumberCard number={me?.number || null} isAnimating={pop} />
        <Input
        placeholder="連想ワード"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={50}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleDecide();
        }}
        size="sm"
        bg={UI_TOKENS.COLORS.panelBg}
        color="white"
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha60}`}
        borderRadius={4}
        boxShadow="inset 1px 1px 2px rgba(0,0,0,0.4), 0 1px 2px rgba(255,255,255,0.1)"
        _placeholder={{ color: UI_TOKENS.COLORS.whiteAlpha50 }}
        _focus={{
          borderColor: UI_TOKENS.COLORS.dqBlue,
          boxShadow: "inset 1px 1px 2px rgba(0,0,0,0.4), 0 0 0 2px rgba(58,176,255,0.4)",
          bg: UI_TOKENS.COLORS.panelBg,
        }}
        _hover={{
          borderColor: UI_TOKENS.COLORS.whiteAlpha80,
          bg: UI_TOKENS.COLORS.panelBg,
        }}
        w={{ base: "48vw", md: "420px" }}
        maxW="560px"
      />
      <Tooltip content="連想ワードを決定" showArrow openDelay={300}>
        <AppButton
          size="sm"
          visual="solid"
          palette="brand"
          onClick={handleDecide}
          disabled={!canDecide}
          px={4}
          py={2}
          bg="rgba(71, 85, 105, 0.9)"
          color="white"
          border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0}
          fontWeight="600"
          boxShadow={UI_TOKENS.SHADOWS.cardRaised}
          _hover={{
            bg: "rgba(100, 116, 139, 0.9)",
            borderColor: "white",
            transform: "translateY(-1px)",
          }}
          _active={{
            transform: "translateY(0)",
            boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
          }}
          transition="all 0.15s ease"
        >
          決定
        </AppButton>
      </Tooltip>
      <Tooltip content="カードを場に出す" showArrow openDelay={300}>
        <AppButton
          size="sm"
          visual="solid"
          palette="brand"
          onClick={handleSubmit}
          disabled={!canSubmit}
          px={4}
          py={2}
          bg="rgba(75, 85, 99, 0.9)"
          color="white"
          border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0}
          fontWeight="600"
          boxShadow={UI_TOKENS.SHADOWS.cardRaised}
          _hover={{
            bg: "rgba(107, 114, 128, 0.9)",
            borderColor: "white",
            transform: "translateY(-1px)",
          }}
          _active={{
            transform: "translateY(0)",
            boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
          }}
          transition="all 0.15s ease"
        >
          出す
        </AppButton>
      </Tooltip>
      </HStack>

      {/* Spacer */}
      <Box flex="1" />

      {/* Right cluster */}
      <HStack gap={3} align="center">
        {isHost && roomStatus === "waiting" && (
          <Tooltip content="ゲームを開始する" showArrow openDelay={300}>
            <AppButton
              size="md"
              visual="solid"
              onClick={quickStart}
              minW="110px"
              px={4}
              py={2}
              bg={UI_TOKENS.GRADIENTS.forestGreen}
              color="white"
              border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha95}`}
              borderRadius={0}
              fontWeight="700"
              fontFamily="monospace"
              textShadow="1px 1px 0px #000"
              boxShadow={UI_TOKENS.SHADOWS.cardRaised}
              _hover={{
                bg: UI_TOKENS.GRADIENTS.forestGreenHover,
                color: UI_TOKENS.COLORS.whiteAlpha95,
                textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                borderColor: "white",
                transform: "translateY(-1px)",
              }}
              _active={{
                bg: UI_TOKENS.GRADIENTS.forestGreenActive,
                color: UI_TOKENS.COLORS.whiteAlpha90,
                boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                transform: "translateY(0)",
              }}
              transition="all 0.15s ease"
            >
              ゲーム開始
            </AppButton>
          </Tooltip>
        )}
        {isHost && isSortSubmit(actualResolveMode) && roomStatus === "clue" && (
          <Tooltip content="みんなで一齐に提出" showArrow openDelay={300}>
            <AppButton
              size="md"
              visual="solid"
              onClick={evalSorted}
              disabled={!allSubmitted}
              minW="110px"
              px={4}
              py={2}
              bg={UI_TOKENS.GRADIENTS.royalPurple}
              color="white"
              border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha95}`}
              borderRadius={0}
              fontWeight="700"
              fontFamily="monospace"
              textShadow="1px 1px 0px #000"
              boxShadow={UI_TOKENS.SHADOWS.cardRaised}
              _hover={{
                bg: UI_TOKENS.GRADIENTS.royalPurpleHover,
                color: UI_TOKENS.COLORS.whiteAlpha95,
                textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                borderColor: "white",
                transform: "translateY(-1px)",
              }}
              _active={{
                bg: UI_TOKENS.GRADIENTS.royalPurpleActive,
                color: UI_TOKENS.COLORS.whiteAlpha90,
                boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                transform: "translateY(0)",
              }}
              _disabled={{
                bg: UI_TOKENS.COLORS.blackAlpha60,
                color: UI_TOKENS.COLORS.whiteAlpha40,
                borderColor: UI_TOKENS.COLORS.whiteAlpha50,
                cursor: "not-allowed",
                textShadow: "1px 1px 0px #000",
              }}
              transition="all 0.15s ease"
            >
              せーの！
            </AppButton>
          </Tooltip>
        )}
        {isHost &&
          ((roomStatus === "reveal" && !!allowContinueAfterFail) ||
            roomStatus === "finished") && (
            <Tooltip content="失敗後も続ける" showArrow openDelay={300}>
              <AppButton
                size="md"
                visual="solid"
                onClick={roomStatus === "finished" ? resetGame : continueRound}
                minW="110px"
                px={4}
                py={2}
                bg={UI_TOKENS.GRADIENTS.orangeSunset}
                color="white"
                border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha95}`}
                borderRadius={0}
                fontWeight="700"
                fontFamily="monospace"
                textShadow="1px 1px 0px #000"
                boxShadow={UI_TOKENS.SHADOWS.cardRaised}
                _hover={{
                  bg: UI_TOKENS.GRADIENTS.orangeSunsetHover,
                  color: UI_TOKENS.COLORS.whiteAlpha95,
                  textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                  borderColor: "white",
                  transform: "translateY(-1px)",
                }}
                _active={{
                  bg: UI_TOKENS.GRADIENTS.orangeSunsetActive,
                  color: UI_TOKENS.COLORS.whiteAlpha90,
                  boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                  transform: "translateY(0)",
                }}
                transition="all 0.15s ease"
              >
                もう一度
              </AppButton>
            </Tooltip>
          )}

        <HStack gap={2}>
          {isHost && (
            <>
              <Tooltip content="お題をシャッフルする" showArrow openDelay={300}>
                <IconButton
                  aria-label="お題シャッフル"
                  onClick={() => {
                    if (defaultTopicType === "カスタム") {
                      if (!isHost) return;
                      setCustomText(currentTopic || "");
                      setCustomOpen(true);
                    } else {
                      topicControls.shuffleTopic(roomId, defaultTopicType as any);
                    }
                  }}
                  size="sm"
                  w="36px"
                  h="36px"
                  bg={UI_TOKENS.COLORS.panelBg}
                  color="white"
                  border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha80}`}
                  borderRadius={0}
                  boxShadow={UI_TOKENS.SHADOWS.cardRaised}
                  _hover={{
                    bg: UI_TOKENS.COLORS.dqBlue,
                    borderColor: "white",
                    transform: "translateY(-1px)",
                  }}
                  _active={{
                    transform: "translateY(0)",
                    boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                  }}
                  transition="all 0.15s ease"
                >
                  <FaRegCreditCard />
                </IconButton>
              </Tooltip>
              <Tooltip content="数字を配り直す" showArrow openDelay={300}>
                <IconButton
                  aria-label="数字配布"
                  onClick={() => topicControls.dealNumbers(roomId)}
                  size="sm"
                  w="36px"
                  h="36px"
                  bg={UI_TOKENS.COLORS.panelBg}
                  color="white"
                  border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha80}`}
                  borderRadius={0}
                  boxShadow={UI_TOKENS.SHADOWS.cardRaised}
                  _hover={{
                    bg: UI_TOKENS.COLORS.limeGreen,
                    borderColor: "white",
                    transform: "translateY(-1px)",
                  }}
                  _active={{
                    transform: "translateY(0)",
                    boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                  }}
                  transition="all 0.15s ease"
                >
                  <FaDice />
                </IconButton>
              </Tooltip>
              <Tooltip content="ゲームをリセット" showArrow openDelay={300}>
                <IconButton
                  aria-label="リセット"
                  onClick={resetGame}
                  size="sm"
                  w="36px"
                  h="36px"
                  bg={UI_TOKENS.COLORS.panelBg}
                  color="white"
                  border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha80}`}
                  borderRadius={0}
                  boxShadow={UI_TOKENS.SHADOWS.cardRaised}
                  _hover={{
                    bg: UI_TOKENS.COLORS.dqRed,
                    borderColor: "white",
                    transform: "translateY(-1px)",
                  }}
                  _active={{
                    transform: "translateY(0)",
                    boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                  }}
                  transition="all 0.15s ease"
                >
                  <FaRedo />
                </IconButton>
              </Tooltip>
            </>
          )}
          {onOpenSettings && (
            <Tooltip content="設定を開く" showArrow openDelay={300}>
              <IconButton
                aria-label="設定"
                onClick={onOpenSettings}
                size="xs"
                bg="transparent"
                color="gray.400"
                borderWidth={0}
              >
                <FiSettings />
              </IconButton>
            </Tooltip>
          )}
          {onLeaveRoom && (
            <Tooltip content="ロビーに戻る" showArrow openDelay={300}>
              <IconButton
                aria-label="退出"
                onClick={onLeaveRoom}
                size="xs"
                bg="transparent"
                color="gray.400"
                borderWidth={0}
              >
                <FiLogOut />
              </IconButton>
            </Tooltip>
          )}
      </HStack>
      {/* カスタムお題入力モーダル（簡易版） */}
      {/* このモーダルは外側クリック/ESCで閉じない（初心者が迷わないように明示ボタンのみ）*/}
      <Dialog.Root open={customOpen} onOpenChange={() => { /* no-op */ }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            css={{
              background: UI_TOKENS.COLORS.panelBg,
              border: `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
              borderRadius: 0,
              boxShadow: UI_TOKENS.SHADOWS.panelDistinct,
              maxWidth: "480px",
              width: "90vw",
            }}
          >
            <Box p={5} css={{ borderBottom: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}` }}>
              <Dialog.Title>
                <Text fontSize="lg" fontWeight="bold" color="white" fontFamily="monospace">
                  お題を入力
                </Text>
              </Dialog.Title>
            </Box>
            <Dialog.Body p={6}>
              <VStack align="stretch" gap={4}>
                <Input
                  placeholder="れい：この夏さいだいのなぞ"
                  value={customText}
                  onChange={(e: any) => setCustomText(e.target.value)}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (customText.trim()) handleSubmitCustom(customText);
                    }
                  }}
                  css={{
                    height: "48px",
                    background: "white",
                    border: "borders.retrogameInput",
                    borderRadius: 0,
                    fontSize: "1rem",
                    padding: "0 16px",
                    color: "black",
                    fontWeight: "normal",
                    fontFamily: "monospace",
                    transition: "none",
                    _placeholder: {
                      color: "#666",
                      fontFamily: "monospace",
                    },
                    _focus: {
                      borderColor: "black",
                      boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                      background: "#f8f8f8",
                      outline: "none",
                    },
                    _hover: {
                      background: "#f8f8f8",
                    },
                  }}
                />
                <HStack justify="space-between" gap={3}>
                  <button
                    onClick={() => setCustomOpen(false)}
                    style={{
                      minWidth: "120px",
                      height: "40px",
                      borderRadius: 0,
                      fontWeight: "bold",
                      fontSize: "1rem",
                      fontFamily: "monospace",
                      border: "borders.retrogameThin",
                      background: "transparent",
                      color: "white",
                      cursor: "pointer",
                      textShadow: "1px 1px 0px #000",
                      transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.color = "var(--colors-richBlack-800)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "white";
                    }}
                  >
                    やめる
                  </button>
                  <button
                    onClick={() => customText.trim() && handleSubmitCustom(customText)}
                    disabled={!customText.trim()}
                    style={{
                      minWidth: "140px",
                      height: "40px",
                      borderRadius: 0,
                      fontWeight: "bold",
                      fontSize: "1rem",
                      fontFamily: "monospace",
                      border: "borders.retrogameThin",
                      background: !customText.trim() ? "#666" : "var(--colors-richBlack-600)",
                      color: "white",
                      cursor: !customText.trim() ? "not-allowed" : "pointer",
                      textShadow: "1px 1px 0px #000",
                      transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                      opacity: !customText.trim() ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (customText.trim()) {
                        e.currentTarget.style.background = "white";
                        e.currentTarget.style.color = "var(--colors-richBlack-800)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (customText.trim()) {
                        e.currentTarget.style.background = "var(--colors-richBlack-600)";
                        e.currentTarget.style.color = "white";
                      }
                    }}
                  >
                    きめる
                  </button>
                </HStack>
              </VStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </HStack>
    </Box>
  );
}
