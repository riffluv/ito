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
  removeCardFromProposal,
  startGame as startGameAction,
  submitSortedOrder,
} from "@/lib/game/room";
import { resetRoomWithPrune } from "@/lib/firebase/rooms";
import { topicControls } from "@/lib/game/topicControls";
import { db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { PlayerDoc } from "@/lib/types";
import { Box, HStack, IconButton, Input, Dialog, Text, VStack } from "@chakra-ui/react";
import React from "react";
import { UI_TOKENS } from "@/theme/layout";
import { FaDice, FaRedo, FaRegCreditCard } from "react-icons/fa";
import { FiLogOut, FiSettings, FiEdit2 } from "react-icons/fi";
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

  // defaultTopicType の即時反映: Firestore反映遅延やローカル保存に追従
  const [effectiveDefaultTopicType, setEffectiveDefaultTopicType] = React.useState<string>(defaultTopicType);
  React.useEffect(() => setEffectiveDefaultTopicType(defaultTopicType), [defaultTopicType]);
  React.useEffect(() => {
    const handler = (e: any) => {
      const v = e?.detail?.defaultTopicType;
      if (typeof v === "string") setEffectiveDefaultTopicType(v);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("defaultTopicTypeChanged", handler as any);
      try {
        const v = window.localStorage.getItem("defaultTopicType");
        if (v) setEffectiveDefaultTopicType(v);
      } catch {}
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("defaultTopicTypeChanged", handler as any);
      }
    };
  }, []);

  const [text, setText] = React.useState<string>(me?.clue1 || "");
  const [isRestarting, setIsRestarting] = React.useState(false);
  const [isRevealAnimating, setIsRevealAnimating] = React.useState(
    roomStatus === "reveal"
  );
  const [inlineFeedback, setInlineFeedback] = React.useState<
    { message: string; tone: "info" | "success" } | null
  >(null);

  React.useEffect(() => {
    if (!inlineFeedback) return;
    const timer = setTimeout(() => setInlineFeedback(null), 2000);
    return () => clearTimeout(timer);
  }, [inlineFeedback]);

  // 連想ワードの同期を強化（空文字列の場合も確実にリセット）
  React.useEffect(() => {
    const newValue = me?.clue1 || "";
    setText(newValue);
  }, [me?.clue1]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string; animating?: boolean }>).detail;
      if (!detail) return;
      if (detail.roomId && detail.roomId !== roomId) return;
      setIsRevealAnimating(!!detail.animating);
    };
    window.addEventListener("ito:reveal-animating", handler as EventListener);
    return () => {
      window.removeEventListener("ito:reveal-animating", handler as EventListener);
    };
  }, [roomId]);

  React.useEffect(() => {
    if (roomStatus === "reveal") {
      setIsRevealAnimating(true);
    } else {
      setIsRevealAnimating(false);
    }
  }, [roomStatus]);

  const actualResolveMode = normalizeResolveMode(resolveMode);
  const isSortMode = isSortSubmit(actualResolveMode);
  const trimmedText = text.trim();
  const hasText = trimmedText.length > 0;
  const clueEditable = roomStatus === "waiting" || roomStatus === "clue";
  const placed = !!proposal?.includes(me?.id || "");
  const ready = !!(me && (me as any).ready === true);
  const canDecide =
    clueEditable && !!me?.id && typeof me?.number === "number" && hasText;
  const allSubmitted = computeAllSubmitted({
    mode: actualResolveMode,
    eligibleIds,
    proposal,
  });
  const canSubmitBase = canSubmitCard({
    mode: actualResolveMode,
    canDecide: !!me?.id && typeof me?.number === "number" && !!me?.clue1?.trim(), // Firebase保存済みチェック
    ready,
    placed,
    cluesReady,
  });
  const canSubmit = clueEditable && canSubmitBase;

  const canClickProposalButton = isSortMode
    ? !!me?.id && clueEditable && (placed || canSubmitBase)
    : !!me?.id && canSubmit;

  React.useEffect(() => {
    if (!clueEditable) {
      setInlineFeedback(null);
    }
  }, [clueEditable]);

  const actionLabel = isSortMode && placed ? "戻す" : "出す";
  const baseActionTooltip = isSortMode && placed
    ? "カードを待機エリアに戻す"
    : "カードを場に出す";
  const clearButtonDisabled = !clueEditable || !hasText || placed;
  const clearTooltip = !clueEditable
    ? "判定中は操作できません"
    : placed
      ? "カード提出中は操作できません"
      : !hasText
        ? "連想ワードが入力されていません"
        : "連想ワードをクリア";
  const decideTooltip = !clueEditable
    ? "判定中は操作できません"
    : !hasText
      ? "連想ワードを入力してください"
      : "連想ワードを決定";
  const submitTooltip = !clueEditable ? "判定中は操作できません" : baseActionTooltip;

  const handleDecide = async () => {
    if (!canDecide || !me?.id) return;

    try {
      await updateClue1(roomId, me.id, trimmedText);
      setInlineFeedback({ message: "連想ワードを保存しました", tone: "success" });
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

  const handleClear = async () => {
    if (!clueEditable || !me?.id) return;
    try {
      await updateClue1(roomId, me.id, "");
      setText("");
      setInlineFeedback({ message: "連想ワードをクリアしました", tone: "info" });
    } catch (e: any) {
      notify({
        title: "クリアに失敗しました",
        description: e?.message,
        type: "error",
      });
    }
  };

  const handleSubmit = async () => {
    if (!me?.id || !clueEditable) return;

    const isRemoving = isSortMode && placed;
    if (isSortMode) {
      if (!placed && !canSubmit) return;
    } else {
      if (!canSubmit || !cluesReady) return;
    }

    try {
      if (isSortMode) {
        if (isRemoving) {
          await removeCardFromProposal(roomId, me.id);
          setInlineFeedback({ message: "カードを待機エリアに戻しました", tone: "info" });
        } else {
          await addCardToProposal(roomId, me.id);
          setInlineFeedback({ message: "カードを提出しました", tone: "success" });
        }
      } else {
        await commitPlayFromClue(roomId, me.id);
        setInlineFeedback({ message: "カードを提出しました", tone: "success" });
      }
    } catch (e: any) {
      const actionLabel = isRemoving ? "カードを戻す" : "カードを出す";
      if (isFirebaseQuotaExceeded(e)) {
        handleFirebaseQuotaError(actionLabel);
        notify({
          title: "Firebase 制限により処理できません",
          description: "現在カード操作を完了できません。しばらく待って再度お試しください。",
          type: "error",
        });
      } else {
        notify({
          title: actionLabel + "処理に失敗しました",
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
    try {
      // カスタムお題確定後、まだゲームが始まっていなければ開始→配布まで自動進行
      if ((roomStatus === "waiting" || customStartPending) && isSortSubmit(actualResolveMode)) {
        await startGameAction(roomId);
        await topicControls.dealNumbers(roomId);
        notify({ title: "カスタムお題で開始", type: "success", duration: 1500 });
      }
    } finally {
      setCustomStartPending(false);
    }
  };

  const quickStart = async () => {
    // サーバのオプションだけを使用（最新値を明示取得して反映遅延を吸収）
    let effectiveType = defaultTopicType as string;
    let latestTopic: string | null = currentTopic ?? null;
    try {
      if (db) {
        const snap = await getDoc(doc(db, "rooms", roomId));
        const data = snap.data() as any;
        const latestType = data?.options?.defaultTopicType as string | undefined;
        if (latestType && typeof latestType === "string") effectiveType = latestType;
        const topicFromSnapshot = data?.topic;
        if (typeof topicFromSnapshot === "string") {
          latestTopic = topicFromSnapshot;
        } else if (topicFromSnapshot == null) {
          latestTopic = null;
        }
      }
    } catch {}

    const topicToUse = typeof latestTopic === "string" ? latestTopic : "";
    if (effectiveType === "カスタム") {
      // お題未設定なら、まだ開始せずにモーダルへ誘導
      if (!topicToUse.trim()) {
        setCustomStartPending(true);
        setCustomText("");
        setCustomOpen(true);
        return;
      }
      // すでにお題があるなら開始→配布
      await startGameAction(roomId);
      await topicControls.dealNumbers(roomId);
      notify({ title: "カスタムお題で開始", type: "success", duration: 1500 });
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

  const resetGame = async () => {
    try {
      // 在席者だけでやり直すための keep を決定（presence のオンラインUIDを利用）
      const keep = Array.isArray(roundIds) && Array.isArray(onlineUids)
        ? roundIds.filter((id) => onlineUids.includes(id))
        : (onlineUids || []);

      // オプション: リセット前に不在者を一括追い出し（prune）
      // NEXT_PUBLIC_RESET_PRUNE=0 / false で無効化可能
      const shouldPrune = (() => {
        try {
          const raw = (process.env.NEXT_PUBLIC_RESET_PRUNE || "").toString().toLowerCase();
          if (!raw) return true; // 既定: 有効
          return !(raw === "0" || raw === "false");
        } catch {
          return true;
        }
      })();

      if (shouldPrune && Array.isArray(roundIds)) {
        const keepSet = new Set(keep);
        const targets = roundIds.filter((id) => !keepSet.has(id));
        if (targets.length > 0) {
          try {
            const auth = getAuth();
            const user = auth.currentUser;
            const token = await user?.getIdToken();
            if (token && user?.uid) {
              console.log("[ゲームリセット] 削除リクエスト", { roomId, targetsCount: targets.length });
              await fetch(`/api/rooms/${roomId}/prune`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, callerUid: user.uid, targets }),
              }).catch(() => {});
            }
          } catch {}
        }
      }

      await resetRoomWithPrune(roomId, keep, { notifyChat: true });
      notify({ title: "ゲームをリセット！", type: "success" });
      try { postRoundReset(roomId); } catch {}
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      console.error("❌ resetGame: 失敗", e);
      notify({ title: "リセットに失敗しました", description: msg, type: "error" });
    }
  };

  const restartGame = async () => {
    await resetGame();
    await quickStart();
  };

  const handleNextGame = async () => {
    if (!isHost) return;
    if (isRestarting) return;
    if (roomStatus === "reveal" && isRevealAnimating) return;

    setIsRestarting(true);
    try {
      await restartGame();
    } catch (e) {
      console.error("❌ nextGameButton: 失敗", e);
    } finally {
      setIsRestarting(false);
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
      css={{
        background: "rgba(8,9,15,0.9)",
        border: "3px solid rgba(255,255,255,0.9)",
        borderRadius: 0,
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.4)",
      }}
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
      <Tooltip content={decideTooltip} showArrow openDelay={300}>
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
      <Tooltip
        content={clearTooltip}
        showArrow
        openDelay={300}
      >
        <AppButton
          size="sm"
          visual="outline"
          palette="gray"
          onClick={handleClear}
          disabled={clearButtonDisabled}
          px={3}
          py={2}
          bg="rgba(55, 65, 81, 0.7)"
          color="white"
          border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha60}`}
          borderRadius={0}
          fontWeight="600"
          boxShadow={UI_TOKENS.SHADOWS.cardRaised}
          _hover={{
            bg: "rgba(75, 85, 99, 0.8)",
            borderColor: UI_TOKENS.COLORS.whiteAlpha90,
            transform: "translateY(-1px)",
          }}
          _active={{
            transform: "translateY(0)",
            boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
          }}
          transition="all 0.15s ease"
        >
          クリア
        </AppButton>
      </Tooltip>
      <Tooltip content={submitTooltip} showArrow openDelay={300}>
        <AppButton
          size="sm"
          visual="solid"
          palette="brand"
          onClick={handleSubmit}
          disabled={!canClickProposalButton}
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
          {actionLabel}
        </AppButton>
      </Tooltip>
      </HStack>

      {inlineFeedback && (
        <Text
          mt={2}
          fontSize="0.75rem"
          color={inlineFeedback.tone === "success" ? UI_TOKENS.COLORS.whiteAlpha90 : UI_TOKENS.COLORS.whiteAlpha60}
          fontFamily="monospace"
        >
          {inlineFeedback.message}
        </Text>
      )}

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
            <AppButton
              size="md"
              visual="solid"
              onClick={handleNextGame}
              disabled={
                isRestarting ||
                (roomStatus === "reveal" && isRevealAnimating)
              }
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
              次のゲーム
            </AppButton>
          )}

        <HStack gap={2}>
          {isHost && (
            <>
              <Tooltip content={effectiveDefaultTopicType === "カスタム" ? "カスタムお題を設定" : "お題をシャッフルする"} showArrow openDelay={300}>
                <IconButton
                  aria-label="お題シャッフル"
                  onClick={async () => {
                    // 最新のオプションを取得して判定の不整合を防ぐ
                    let mode = effectiveDefaultTopicType;
                    try {
                      if (db) {
                        const snap = await getDoc(doc(db, "rooms", roomId));
                        const latest = (snap.data() as any)?.options?.defaultTopicType as string | undefined;
                        if (latest) mode = latest;
                      }
                    } catch {}
                    if (mode === "カスタム") {
                      if (!isHost) return;
                      setCustomText(currentTopic || "");
                      setCustomOpen(true);
                    } else {
                      await topicControls.shuffleTopic(roomId, mode as any);
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
                    bg: effectiveDefaultTopicType === "カスタム" ? UI_TOKENS.COLORS.purpleAlpha80 : UI_TOKENS.COLORS.dqBlue,
                    borderColor: "white",
                    transform: "translateY(-1px)",
                  }}
                  _active={{
                    transform: "translateY(0)",
                    boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                  }}
                  transition="all 0.15s ease"
                >
                  {effectiveDefaultTopicType === "カスタム" ? <FiEdit2 /> : <FaRegCreditCard />}
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
                  onClick={async () => {
                    await resetGame();
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
          {/* 非ホストでもカスタムモード時は"ペン"を表示（待機/連想フェーズのみ） */}
          {(!isHost && defaultTopicType === "カスタム" && (roomStatus === "waiting" || roomStatus === "clue")) && (
            <Tooltip content="カスタムお題を設定" showArrow openDelay={300}>
              <IconButton
                aria-label="カスタムお題"
                onClick={() => {
                  setCustomText(currentTopic || "");
                  setCustomOpen(true);
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
                  bg: UI_TOKENS.COLORS.purpleAlpha80,
                  borderColor: "white",
                  transform: "translateY(-1px)",
                }}
                _active={{
                  transform: "translateY(0)",
                  boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                }}
                transition="all 0.15s ease"
              >
                <FiEdit2 />
              </IconButton>
            </Tooltip>
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
