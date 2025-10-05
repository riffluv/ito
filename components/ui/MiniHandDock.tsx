"use client";
import { useHostAutoStartLock } from "@/components/hooks/useHostAutoStartLock";
import { AppButton } from "@/components/ui/AppButton";
import OctopathDockButton from "@/components/ui/OctopathDockButton";
import { notify, muteNotifications } from "@/components/ui/notify";
import Tooltip from "@/components/ui/Tooltip";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { db } from "@/lib/firebase/client";
import { updateClue1 } from "@/lib/firebase/players";
import { resetRoomWithPrune } from "@/lib/firebase/rooms";
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
import { topicControls } from "@/lib/game/topicControls";
import type { PlayerDoc } from "@/lib/types";
import { postRoundReset } from "@/lib/utils/broadcast";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { logInfo } from "@/lib/utils/log";
import { UI_TOKENS } from "@/theme/layout";
import { toastIds } from "@/lib/ui/toastIds";
import {
  Box,
  Dialog,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React from "react";
import { FaDice, FaRedo, FaRegCreditCard } from "react-icons/fa";
import { FiEdit2, FiLogOut, FiSettings } from "react-icons/fi";
import { DiamondNumberCard } from "./DiamondNumberCard";
import { SeinoButton } from "./SeinoButton";

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
  topicBox?: string | null;
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
    topicBox = null,
    onOpenSettings,
    onLeaveRoom,
    pop = false,
    onlineUids,
    roundIds,
    currentTopic,
  } = props;

  // defaultTopicType の即時反映: Firestore反映遅延やローカル保存に追従
  const [effectiveDefaultTopicType, setEffectiveDefaultTopicType] =
    React.useState<string>(defaultTopicType);
  React.useEffect(
    () => setEffectiveDefaultTopicType(defaultTopicType),
    [defaultTopicType]
  );
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
  const [quickStartPending, setQuickStartPending] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);
  const [isRevealAnimating, setIsRevealAnimating] = React.useState(
    roomStatus === "reveal"
  );
  const [inlineFeedback, setInlineFeedback] = React.useState<{
    message: string;
    tone: "info" | "success";
  } | null>(null);
  const [topicActionLoading, setTopicActionLoading] = React.useState(false);
  const [dealActionLoading, setDealActionLoading] = React.useState(false);

  const {
    autoStartLocked,
    beginLock: beginAutoStartLock,
    clearLock: clearAutoStartLock,
    showIndicator: showAutoStartIndicator,
  } = useHostAutoStartLock(roomId, roomStatus);

  React.useEffect(() => {
    if (!inlineFeedback) return;
    if (inlineFeedback.tone === "info") return;
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
      const detail = (
        event as CustomEvent<{ roomId?: string; animating?: boolean }>
      ).detail;
      if (!detail) return;
      if (detail.roomId && detail.roomId !== roomId) return;
      setIsRevealAnimating(!!detail.animating);
    };
    window.addEventListener("ito:reveal-animating", handler as EventListener);
    return () => {
      window.removeEventListener(
        "ito:reveal-animating",
        handler as EventListener
      );
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
  const isCustomModeSelectable =
    topicBox === "カスタム" ||
    (!topicBox && effectiveDefaultTopicType === "カスタム");
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
    canDecide:
      !!me?.id && typeof me?.number === "number" && !!me?.clue1?.trim(), // Firebase保存済みチェック
    ready,
    placed,
    cluesReady,
  });
  const canSubmit = clueEditable && canSubmitBase;

  const canClickProposalButton = isSortMode
    ? !!me?.id && clueEditable && (placed || canSubmitBase)
    : !!me?.id && canSubmit;

  // ホスト視点でソート中かつ全員提出済みの場合のみ「せーの！」を出す
  const shouldShowSeinoButton =
    !!isHost && isSortMode && roomStatus === "clue" && allSubmitted;

  React.useEffect(() => {
    if (!clueEditable) {
      setInlineFeedback(null);
    }
  }, [clueEditable]);


  const actionLabel = isSortMode && placed ? "戻す" : "出す";
  const baseActionTooltip =
    isSortMode && placed ? "カードを待機エリアに戻す" : "カードを場に出す";
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
  const submitDisabledReason = !clueEditable
    ? "このタイミングではカードを出せません"
    : !me?.id
      ? "参加処理が終わるまで待ってください"
      : typeof me?.number !== "number"
        ? "番号が配られるまで待ってください"
        : !hasText
          ? "連想ワードを入力するとカードを出せます"
          : !ready
            ? "「決定」を押すとカードを出せます"
            : "カードを場に出せません";
    const submitTooltip = canClickProposalButton ? baseActionTooltip : submitDisabledReason;

    const playOrderConfirm = useSoundEffect("order_confirm");
    const playCardPlace = useSoundEffect("card_place");
    const playCardDeal = useSoundEffect("card_deal");
    const playTopicShuffle = useSoundEffect("topic_shuffle");
    const playResetGame = useSoundEffect("reset_game");

    // ⚡ PERFORMANCE: useCallbackでメモ化して不要な関数再生成を防止
    const handleDecide = React.useCallback(async () => {
    if (!canDecide || !me?.id) return;

    try {
      await updateClue1(roomId, me.id, trimmedText);
      setInlineFeedback({
        message: "連想ワードを保存しました",
        tone: "success",
      });
    } catch (e: any) {
      if (isFirebaseQuotaExceeded(e)) {
        handleFirebaseQuotaError("連想ワード記録");
        notify({
          id: toastIds.firebaseLimit(roomId, "clue-save"),
          title: "接続制限のため記録不可",
          description:
            "現在連想ワードを記録できません。24時間後に再度お試しください。",
          type: "error",
        });
      } else {
        notify({
          id: toastIds.clueSaveError(roomId),
          title: "記録に失敗しました",
          description: e?.message,
          type: "error",
        });
      }
    }
  }, [canDecide, me?.id, roomId, trimmedText]);

  // ⚡ PERFORMANCE: useCallbackでメモ化
  const handleClear = React.useCallback(async () => {
    if (!clueEditable || !me?.id) return;
    try {
      await updateClue1(roomId, me.id, "");
      setText("");
      setInlineFeedback({
        message: "連想ワードをクリアしました",
        tone: "info",
      });
    } catch (e: any) {
      notify({
        id: toastIds.clueClearError(roomId),
        title: "クリアに失敗しました",
        description: e?.message,
        type: "error",
      });
    }
  }, [clueEditable, me?.id, roomId]);

  // ⚡ PERFORMANCE: useCallbackでメモ化
  const handleSubmit = React.useCallback(async () => {
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
            playCardPlace();
            setInlineFeedback({
              message: "カードを待機エリアに戻しました",
              tone: "info",
            });
          } else {
            await addCardToProposal(roomId, me.id);
            playCardPlace();
            setInlineFeedback({
              message: "カードを提出しました",
              tone: "success",
            });
          }
        } else {
          await commitPlayFromClue(roomId, me.id);
          playCardPlace();
          setInlineFeedback({ message: "カードを提出しました", tone: "success" });
        }
    } catch (e: any) {
      const actionLabel = isRemoving ? "カードを戻す" : "カードを出す";
      if (isFirebaseQuotaExceeded(e)) {
        handleFirebaseQuotaError(actionLabel);
        notify({
          id: toastIds.firebaseLimit(roomId, "card-action"),
          title: "Firebase 制限により処理できません",
          description:
            "現在カード操作を完了できません。しばらく待って再度お試しください。",
          type: "error",
        });
      } else {
        notify({
          id: toastIds.cardActionError(roomId),
          title: actionLabel + "処理に失敗しました",
          description: e?.message,
          type: "error",
        });
      }
    }
    }, [
      me?.id,
      clueEditable,
      isSortMode,
      placed,
      canSubmit,
      cluesReady,
      roomId,
      playCardPlace,
    ]);

  // カスタムお題モーダル制御
    const [customOpen, setCustomOpen] = React.useState(false);
    const [customStartPending, setCustomStartPending] = React.useState(false);
    const [customText, setCustomText] = React.useState<string>("");
  // ⚡ PERFORMANCE: useCallbackでメモ化
  const handleSubmitCustom = React.useCallback(async (val: string) => {
    const v = (val || "").trim();
    if (!v) return;
    await topicControls.setCustomTopic(roomId, v);
    setCustomOpen(false);

    if (!isHost) {
      setCustomStartPending(false);
      notify({
        id: toastIds.topicChangeSuccess(roomId),
        title: "お題を更新しました",
        description: "ホストが開始するとゲームがスタートします",
        type: "success",
        duration: 1800,
      });
      return;
    }

    try {
      // カスタムお題確定後、まだゲームが始まっていなければ開始→配布まで自動進行
      if (
        (roomStatus === "waiting" || customStartPending) &&
        isSortSubmit(actualResolveMode)
      ) {
        playOrderConfirm();
        await startGameAction(roomId);
        await topicControls.dealNumbers(roomId);
        notify({
          id: toastIds.gameStart(roomId),
          title: "カスタムお題で開始",
          type: "success",
          duration: 2000,
        });
      }
    } finally {
      setCustomStartPending(false);
    }
    }, [
      roomId,
      isHost,
      roomStatus,
      customStartPending,
      actualResolveMode,
      playOrderConfirm,
      playTopicShuffle,
    ]);

  const quickStart = async (opts?: { broadcast?: boolean; playSound?: boolean }) => {
    if (quickStartPending) return false;

    setQuickStartPending(true);

    muteNotifications(
      [
        toastIds.topicChangeSuccess(roomId),
        toastIds.topicShuffleSuccess(roomId),
        toastIds.numberDealSuccess(roomId),
        toastIds.gameReset(roomId),
      ],
      2800
    );

    let effectiveType = defaultTopicType as string;
    let latestTopic: string | null = currentTopic ?? null;
    try {
      if (db) {
        const snap = await getDoc(doc(db, "rooms", roomId));
        const data = snap.data() as any;
        const latestType = data?.options?.defaultTopicType as
          | string
          | undefined;
        if (latestType && typeof latestType === "string")
          effectiveType = latestType;
        const topicFromSnapshot = data?.topic;
        if (typeof topicFromSnapshot === "string") {
          latestTopic = topicFromSnapshot;
        } else if (topicFromSnapshot == null) {
          latestTopic = null;
        }
      }
    } catch {}

    const topicToUse = typeof latestTopic === "string" ? latestTopic : "";
    if (effectiveType === "カスタム" && !topicToUse.trim()) {
      setCustomStartPending(true);
      setCustomText("");
      setCustomOpen(true);
      setQuickStartPending(false);
      return false;
    }

      const shouldBroadcast = opts?.broadcast ?? true;
      const shouldPlaySound = opts?.playSound ?? true;
    beginAutoStartLock(4500, { broadcast: shouldBroadcast });

    let success = false;
    try {
      if (effectiveType === "カスタム") {
        if (shouldPlaySound) {
          playOrderConfirm();
        }
        await startGameAction(roomId);
        await topicControls.dealNumbers(roomId);
        try {
          postRoundReset(roomId);
        } catch {}
      } else {
        if (shouldPlaySound) {
          playOrderConfirm();
        }
        await startGameAction(roomId);
        try {
          delete (window as any).__ITO_LAST_RESET;
        } catch {}
        const selectType =
          effectiveType === "カスタム" ? "通常版" : effectiveType;
        await topicControls.selectCategory(roomId, selectType as any);
        await topicControls.dealNumbers(roomId);
        try {
          postRoundReset(roomId);
        } catch {}
      }
      success = true;
    } catch (error: any) {
      clearAutoStartLock();
      if (isFirebaseQuotaExceeded(error)) {
        handleFirebaseQuotaError("ゲーム開始");
      } else {
        const message = error?.message || "処理に失敗しました";
        notify({
          id: toastIds.gameStartError(roomId),
          title: "ゲーム開始に失敗しました",
          description: message,
          type: "error",
        });
      }
    } finally {
      setQuickStartPending(false);
    }

    return success;
  };

  const evalSorted = async () => {
    if (!allSubmitted) return;
    const list = (proposal || []).filter(
      (v): v is string => typeof v === "string" && v.length > 0
    );
    playOrderConfirm();
    await submitSortedOrder(roomId, list);
  };

  const resetGame = async (options?: { showFeedback?: boolean; playSound?: boolean }) => {
    const showFeedback = options?.showFeedback ?? true;
    const shouldPlaySound = options?.playSound ?? true;
    setIsResetting(true);
    if (shouldPlaySound) {
      playResetGame();
    }
    if (showFeedback) {
      setInlineFeedback({ message: "リセット中…", tone: "info" });
    } else {
      setInlineFeedback(null);
    }
    try {
      // 在席者だけでやり直すための keep を決定（presence のオンラインUIDを利用）
      // 観戦者も復帰対象に含める改善
      const keepSet = new Set<string>();

      // ラウンド参加者を追加
      if (Array.isArray(roundIds)) {
        roundIds.forEach((id) => {
          if (typeof id === "string" && id.trim().length > 0) {
            keepSet.add(id);
          }
        });
      }

      // オンラインユーザーを追加
      if (Array.isArray(onlineUids)) {
        onlineUids.forEach((id) => {
          if (typeof id === "string" && id.trim().length > 0) {
            keepSet.add(id);
          }
        });
      }

      const keep = Array.from(keepSet);

      // オプション: リセット前に不在者を一括追い出し（prune）
      // NEXT_PUBLIC_RESET_PRUNE=0 / false で無効化可能
      const shouldPrune = (() => {
        try {
          const raw = (process.env.NEXT_PUBLIC_RESET_PRUNE || "")
            .toString()
            .toLowerCase();
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
              logInfo("rooms", "reset prune request", {
                roomId,
                targetsCount: targets.length,
              });
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
      if (showFeedback) {
        setInlineFeedback({
          message: "待機状態に戻しました！",
          tone: "success",
        });
      } else {
        setInlineFeedback(null);
      }
      notify({
        id: toastIds.gameReset(roomId),
        title: "ゲームを待機状態に戻しました",
        type: "success",
        duration: 2000,
      });
      try {
        postRoundReset(roomId);
      } catch {}
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      console.error("❌ resetGame: 失敗", e);
      notify({
        id: toastIds.genericError(roomId, "game-reset"),
        title: "リセットに失敗しました",
        description: msg,
        type: "error",
      });
      setInlineFeedback(null);
    } finally {
      setIsResetting(false);
    }
  };

  const restartGame = async (opts?: { playSound?: boolean }) => {
    await resetGame({ showFeedback: false, playSound: opts?.playSound ?? true });
    return quickStart({ broadcast: false, playSound: opts?.playSound ?? true });
  };

  // ⚡ PERFORMANCE: useCallbackでメモ化
  const handleNextGame = React.useCallback(async () => {
    if (!isHost) return;
    if (autoStartLocked || quickStartPending) return;
    if (roomStatus === "reveal" && isRevealAnimating) return;

    beginAutoStartLock(5000, { broadcast: true });
    setIsRestarting(true);
    try {
      playOrderConfirm();
      const ok = await restartGame({ playSound: false });
      if (!ok) {
        clearAutoStartLock();
      }
    } catch (e) {
      clearAutoStartLock();
      console.error("❌ nextGameButton: 失敗", e);
    } finally {
      setIsRestarting(false);
    }
  }, [
    isHost,
    autoStartLocked,
    quickStartPending,
    roomStatus,
    isRevealAnimating,
    beginAutoStartLock,
    restartGame,
    clearAutoStartLock,
  ]);

  // 動的レイアウト: ホストは左寄せ、ゲストは中央寄せ
  const hasHostButtons =
    isHost &&
    (roomStatus === "waiting" ||
      (isSortSubmit(actualResolveMode) && roomStatus === "clue") ||
      (roomStatus === "reveal" && !!allowContinueAfterFail) ||
      roomStatus === "finished");

  const quickStartDisabled = autoStartLocked || quickStartPending;

  const LOADING_BG = "rgba(42,48,58,0.95)";
  const preparing = !!(
    autoStartLocked ||
    quickStartPending ||
    isRestarting ||
    isResetting
  );
  const isGameFinished = roomStatus === "finished";
  const canShowStart =
    !!isHost &&
    roomStatus === "waiting" &&
    !autoStartLocked &&
    !quickStartPending &&
    !isRestarting;
  // 短時間の待機では何も出さず、一定時間を超えた場合のみプレースホルダを出す
  const showWaitingPlaceholder =
    !!isHost && roomStatus === "waiting" && !!showAutoStartIndicator;

  return (
    <>
      {/* 🔥 せーの！ボタン（フッター外の浮遊ボタン - Octopath風） */}
      <SeinoButton
        isVisible={shouldShowSeinoButton}
        disabled={!allSubmitted}
        onClick={evalSorted}
      />

      <Box
        display="flex"
        flexWrap="wrap"
        alignItems={{ base: "stretch", md: "center" }}
        justifyContent={
          hasHostButtons ? { base: "center", md: "flex-start" } : "center"
        }
        w="100%"
        maxW="1280px"
        mx="auto"
        px={{ base: "17px", md: "22px" }}
        py={{ base: "14px", md: "17px" }}
        columnGap={{ base: "14px", md: "19px" }}
        rowGap={{ base: "11px", md: "14px" }}
        css={{
          background: "linear-gradient(178deg, rgba(9, 14, 24, 0.81) 0%, rgba(7, 11, 19, 0.91) 58%, rgba(8, 12, 21, 0.94) 83%, rgba(5, 8, 15, 0.96) 100%)",
          backdropFilter: "blur(11px) saturate(1.15)",
          border: "2px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 0,
          boxShadow: `
          0 -2px 17px rgba(0, 0, 0, 0.68),
          0 -6px 38px rgba(0, 0, 0, 0.52),
          0 -1px 8px rgba(0, 0, 0, 0.38),
          inset 0 1px 0 rgba(255, 255, 255, 0.07),
          inset 0 -1px 0 rgba(0, 0, 0, 0.28)
        `,
        }}
        position="relative"
        _before={{
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: "linear-gradient(88deg, transparent 0%, rgba(255, 255, 255, 0.16) 38%, rgba(255, 255, 255, 0.23) 56%, transparent 100%)",
        }}
      >
      {/* Left cluster */}
      <HStack
        gap={{ base: "14px", md: "11px" }}
        align="center"
        flexWrap={{ base: "wrap", md: "nowrap" }}
        rowGap={{ base: 2, md: 0 }}
        flex={{ base: "1 1 100%", md: "0 0 auto" }}
      >
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
          bg="rgba(18,22,32,0.95)"
          color="rgba(255,255,255,0.98)"
          fontFamily="'Courier New', monospace"
          fontSize="15px"
          fontWeight="700"
          letterSpacing="0.04em"
          border="none"
          borderRadius={0}
          boxShadow="inset 2px 2px 0 rgba(0,0,0,0.7), inset -1px -1px 0 rgba(255,255,255,0.08), 0 0 0 2px rgba(255,255,255,0.75)"
          _placeholder={{
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.06em",
          }}
          _focus={{
            boxShadow: "inset 2px 2px 0 rgba(0,0,0,0.7), inset -1px -1px 0 rgba(255,255,255,0.12), 0 0 0 2px rgba(255,255,255,0.95)",
            bg: "rgba(22,26,36,0.98)",
            outline: "none",
          }}
          _hover={{
            boxShadow: "inset 2px 2px 0 rgba(0,0,0,0.7), inset -1px -1px 0 rgba(255,255,255,0.1), 0 0 0 2px rgba(255,255,255,0.85)",
            bg: "rgba(20,24,34,0.96)",
          }}
          w={{ base: "100%", md: "280px" }}
          maxW={{ base: "100%", md: "380px" }}
          flex={{ base: "1 1 100%", md: "1 1 auto" }}
          minW={0}
          transition="box-shadow 168ms cubic-bezier(.2,1,.3,1)"
        />
        <Tooltip content={decideTooltip} showArrow openDelay={180}>
          <AppButton
            size="sm"
            visual="solid"
            palette="brand"
            onClick={handleDecide}
            disabled={!canDecide}
            px="20px"
            py="10px"
            bg="rgba(28,32,42,0.95)"
            color="rgba(255,255,255,0.98)"
            border="2px solid rgba(255,255,255,0.88)"
            borderRadius="0"
            fontWeight="900"
            fontFamily="'Courier New', monospace"
            fontSize="15px"
            letterSpacing="0.06em"
            textShadow="1px 1px 0 rgba(0,0,0,0.9)"
            boxShadow="3px 3px 0 rgba(0,0,0,.65)"
            transform="translate(.5px,-.5px)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            _hover={{
              bg: "rgba(38,42,52,0.98)",
              borderColor: "rgba(255,255,255,0.95)",
              transform: "translate(0,-1px)",
              boxShadow: "4px 4px 0 rgba(0,0,0,.7)",
            }}
            _active={{
              transform: "translate(1px,1px)",
              boxShadow: "2px 2px 0 rgba(0,0,0,.75)",
            }}
            _disabled={{
              bg: "rgba(28,32,42,0.5)",
              borderColor: "rgba(255,255,255,0.3)",
              color: "rgba(255,255,255,0.4)",
              filter: "grayscale(0.8)",
              cursor: "not-allowed",
            }}
            transition="177ms cubic-bezier(.2,1,.3,1)"
          >
            決定
          </AppButton>
        </Tooltip>
        <Tooltip content={clearTooltip} showArrow openDelay={180}>
          <AppButton
            size="sm"
            visual="outline"
            palette="gray"
            onClick={handleClear}
            disabled={clearButtonDisabled}
            px="20px"
            py="10px"
            bg="rgba(28,32,42,0.95)"
            color="rgba(255,255,255,0.92)"
            border="2px solid rgba(255,255,255,0.88)"
            borderRadius="0"
            fontWeight="900"
            fontFamily="'Courier New', monospace"
            fontSize="15px"
            letterSpacing="0.06em"
            textShadow="1px 1px 0 rgba(0,0,0,0.9)"
            boxShadow="3px 3px 0 rgba(0,0,0,.65)"
            transform="translate(.5px,-.5px)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            _hover={{
              bg: "rgba(38,42,52,0.98)",
              borderColor: "rgba(255,255,255,0.95)",
              transform: "translate(0,-1px)",
              boxShadow: "4px 4px 0 rgba(0,0,0,.7)",
            }}
            _active={{
              transform: "translate(1px,1px)",
              boxShadow: "2px 2px 0 rgba(0,0,0,.75)",
            }}
            _disabled={{
              bg: "rgba(28,32,42,0.5)",
              borderColor: "rgba(255,255,255,0.3)",
              color: "rgba(255,255,255,0.4)",
              filter: "grayscale(0.8)",
              cursor: "not-allowed",
            }}
            transition="174ms cubic-bezier(.2,1,.3,1)"
          >
            クリア
          </AppButton>
        </Tooltip>
        <Tooltip content={submitTooltip} showArrow openDelay={180}>
          <AppButton
            size="sm"
            visual="solid"
            palette="brand"
            onClick={handleSubmit}
            disabled={!canClickProposalButton}
            px="20px"
            py="10px"
            bg="rgba(28,32,42,0.95)"
            color="rgba(255,255,255,0.98)"
            border="2px solid rgba(255,255,255,0.88)"
            borderRadius="0"
            fontWeight="900"
            fontFamily="'Courier New', monospace"
            fontSize="15px"
            letterSpacing="0.06em"
            textShadow="1px 1px 0 rgba(0,0,0,0.9)"
            boxShadow="3px 3px 0 rgba(0,0,0,.65)"
            transform="translate(.5px,-.5px)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            _hover={{
              bg: "rgba(38,42,52,0.98)",
              borderColor: "rgba(255,255,255,0.95)",
              transform: "translate(0,-1px)",
              boxShadow: "4px 4px 0 rgba(0,0,0,.7)",
            }}
            _active={{
              transform: "translate(1px,1px)",
              boxShadow: "2px 2px 0 rgba(0,0,0,.75)",
            }}
            _disabled={{
              bg: "rgba(28,32,42,0.5)",
              borderColor: "rgba(255,255,255,0.3)",
              color: "rgba(255,255,255,0.4)",
              filter: "grayscale(0.8)",
              cursor: "not-allowed",
            }}
            transition="181ms cubic-bezier(.2,1,.3,1)"
          >
            {actionLabel}
          </AppButton>
        </Tooltip>
      </HStack>

      {/* Spacer */}
      <Box
        flex={{ base: "0 0 100%", md: 1 }}
        display={{ base: "none", md: "block" }}
      />

      {inlineFeedback && (
        <Text
          position="absolute"
          bottom="calc(100% + 7px)"
          left="50%"
          transform="translateX(-50%)"
          fontSize="0.75rem"
          color={
            inlineFeedback.tone === "success"
              ? UI_TOKENS.COLORS.whiteAlpha90
              : UI_TOKENS.COLORS.whiteAlpha60
          }
          fontFamily="monospace"
          bg="rgba(10, 15, 25, 0.95)"
          px="14px"
          py="7px"
          borderRadius="3px"
          border={`1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`}
          boxShadow="0 2px 8px rgba(0,0,0,0.4)"
          whiteSpace="nowrap"
          pointerEvents="none"
          zIndex={10}
        >
          {inlineFeedback.message}
        </Text>
      )}

      {/* Right cluster */}
      <HStack
        gap="14px"
        align="center"
        flexWrap={{ base: "wrap", md: "nowrap" }}
        rowGap={{ base: 2, md: 0 }}
        flex={{ base: "1 1 100%", md: "0 0 auto" }}
        justifyContent={{ base: "center", md: "flex-end" }}
      >
        {isHost && roomStatus === "waiting" && (
          <Tooltip
            content={preparing ? "準備中です" : "ゲームを開始する"}
            showArrow
            openDelay={180}
          >
            <AppButton
              size="md"
              visual="solid"
              onClick={() => quickStart()}
              disabled={preparing}
              minW="148px"
              px="19px"
              py="13px"
              position="relative"
              bg={preparing ? LOADING_BG : "rgba(28,32,42,0.95)"}
              color="rgba(255,255,255,0.98)"
              border="none"
              borderRadius="0"
              fontWeight="900"
              fontFamily="'Courier New', monospace"
              fontSize="16px"
              letterSpacing="0.08em"
              textShadow="2px 2px 0 rgba(0,0,0,0.9)"
              boxShadow="4px 4px 0 rgba(0,0,0,.7), 0 0 0 3px rgba(255,255,255,0.92)"
              transform="translate(.5px,-.5px)"
              _hover={{
                bg: preparing ? LOADING_BG : "rgba(38,42,52,0.98)",
                color: "rgba(255,255,255,1)",
                transform: "translate(0,-2px)",
                boxShadow: "5px 6px 0 rgba(0,0,0,.7), 0 0 0 3px rgba(255,255,255,0.98)",
              }}
              _active={{
                bg: preparing ? LOADING_BG : "rgba(18,22,32,1)",
                color: "rgba(255,255,255,0.9)",
                boxShadow: "2px 2px 0 rgba(0,0,0,.8), 0 0 0 3px rgba(255,255,255,0.85)",
                transform: "translate(1px,1px)",
              }}
              transition="180ms cubic-bezier(.2,1,.3,1)"
            >
              {preparing ? "準備中..." : "ゲーム開始"}
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
                autoStartLocked ||
                isRestarting ||
                (roomStatus === "reveal" && isRevealAnimating)
              }
              minW="148px"
              px="19px"
              py="13px"
              position="relative"
              bg="rgba(28,32,42,0.95)"
              color="rgba(255,255,255,0.98)"
              border="none"
              borderRadius="0"
              fontWeight="900"
              fontFamily="'Courier New', monospace"
              fontSize="16px"
              letterSpacing="0.08em"
              textShadow="2px 2px 0 rgba(0,0,0,0.9)"
              boxShadow="4px 4px 0 rgba(0,0,0,.7), 0 0 0 3px rgba(255,255,255,0.92)"
              transform="translate(.5px,-.5px)"
              _hover={{
                bg: "rgba(38,42,52,0.98)",
                color: "rgba(255,255,255,1)",
                transform: "translate(0,-2px)",
                boxShadow: "5px 6px 0 rgba(0,0,0,.7), 0 0 0 3px rgba(255,255,255,0.98)",
              }}
              _active={{
                bg: "rgba(18,22,32,1)",
                color: "rgba(255,255,255,0.9)",
                boxShadow: "2px 2px 0 rgba(0,0,0,.8), 0 0 0 3px rgba(255,255,255,0.85)",
                transform: "translate(1px,1px)",
              }}
              transition="180ms cubic-bezier(.2,1,.3,1)"
            >
              {showAutoStartIndicator ? "準備中..." : "次のゲーム"}
            </AppButton>
          )}

        <HStack gap={{ base: "10px", md: "12px" }} flexWrap={{ base: "wrap", md: "nowrap" }}>
          {isHost && (
            <>
              <Tooltip
                content={
                  effectiveDefaultTopicType === "カスタム"
                    ? "カスタムお題を設定"
                    : "お題をシャッフル"
                }
                showArrow
                openDelay={220}
              >
                <OctopathDockButton
                  compact
                  icon={
                    effectiveDefaultTopicType === "カスタム" ? (
                      <FiEdit2 />
                    ) : (
                      <FaRegCreditCard />
                    )
                  }
                  isLoading={topicActionLoading}
                  disabled={topicActionLoading || (isGameFinished && effectiveDefaultTopicType !== "カスタム")}
                  onClick={async () => {
                    if (topicActionLoading) return;
                    let mode = effectiveDefaultTopicType;
                    try {
                      if (db) {
                        const snap = await getDoc(doc(db, "rooms", roomId));
                        const latest = (snap.data() as any)?.options?.defaultTopicType as string | undefined;
                        if (latest) mode = latest;
                      }
                    } catch {}

                    if (mode === "カスタム") {
                      setCustomText(currentTopic || "");
                      setCustomOpen(true);
                      return;
                    }

                    if (isGameFinished) return;
                    setTopicActionLoading(true);
                    try {
                      playTopicShuffle();
                      await topicControls.shuffleTopic(roomId, mode as any);
                    } finally {
                      setTopicActionLoading(false);
                    }
                  }}
                />
              </Tooltip>

              <Tooltip content="数字を配り直す" showArrow openDelay={220}>
                <OctopathDockButton
                  compact
                  icon={<FaDice />}
                  isLoading={dealActionLoading}
                  disabled={dealActionLoading || isGameFinished}
                  onClick={async () => {
                    if (dealActionLoading || isGameFinished) return;
                    setDealActionLoading(true);
                    try {
                      playCardDeal();
                      await topicControls.dealNumbers(roomId);
                    } finally {
                      setDealActionLoading(false);
                    }
                  }}
                />
              </Tooltip>

              <Tooltip content="ゲームをリセット" showArrow openDelay={220}>
                <OctopathDockButton
                  compact
                  icon={<FaRedo />}
                  isLoading={isResetting}
                  disabled={isResetting}
                  onClick={async () => {
                    if (isResetting) return;
                    await resetGame({ playSound: !isGameFinished });
                  }}
                />
              </Tooltip>
            </>
          )}
          {/* 非ホストでもカスタムモード時は"ペン"を表示（待機/連想フェーズのみ） */}
          {!isHost &&
            isCustomModeSelectable &&
            (roomStatus === "waiting" || roomStatus === "clue") && (
              <Tooltip content="カスタムお題を設定" showArrow openDelay={300}>
                <IconButton
                  aria-label="カスタムお題"
                  onClick={() => {
                    setCustomText(currentTopic || "");
                    setCustomOpen(true);
                  }}
                  size="sm"
                  w="40px"
                  h="40px"
                  bg="rgba(28,32,42,0.95)"
                  color="rgba(255,255,255,0.92)"
                  borderWidth="0"
                  borderRadius="0"
                  fontFamily="'Courier New', monospace"
                  fontSize="16px"
                  boxShadow="2px 2px 0 rgba(0,0,0,.65), 0 0 0 2px rgba(255,255,255,0.88)"
                  _hover={{
                    bg: "rgba(38,42,52,0.98)",
                    color: "rgba(255,255,255,1)",
                    transform: "translate(0,-1px)",
                    boxShadow: "3px 3px 0 rgba(0,0,0,.7), 0 0 0 2px rgba(255,255,255,0.95)",
                  }}
                  _active={{
                    transform: "translate(1px,1px)",
                    boxShadow: "1px 1px 0 rgba(0,0,0,.75), 0 0 0 2px rgba(255,255,255,0.82)",
                  }}
                  transition="176ms cubic-bezier(.2,1,.3,1)"
                >
                  <FiEdit2 />
                </IconButton>
              </Tooltip>
            )}
          {onOpenSettings && (
            <Tooltip content="設定を開く" showArrow openDelay={180}>
              <IconButton
                aria-label="設定"
                onClick={onOpenSettings}
                size="xs"
                w="36px"
                h="36px"
                bg="rgba(28,32,42,0.95)"
                color="rgba(255,255,255,0.92)"
                borderWidth="0"
                borderRadius="0"
                fontFamily="'Courier New', monospace"
                fontSize="15px"
                boxShadow="2px 2px 0 rgba(0,0,0,.65), 0 0 0 2px rgba(255,255,255,0.88)"
                _hover={{
                  bg: "rgba(38,42,52,0.98)",
                  color: "rgba(255,255,255,1)",
                  transform: "translate(0,-1px)",
                  boxShadow: "3px 3px 0 rgba(0,0,0,.7), 0 0 0 2px rgba(255,255,255,0.95)",
                }}
                _active={{
                  transform: "translate(1px,1px)",
                  boxShadow: "1px 1px 0 rgba(0,0,0,.75), 0 0 0 2px rgba(255,255,255,0.82)",
                }}
                transition="175ms cubic-bezier(.2,1,.3,1)"
              >
                <FiSettings />
              </IconButton>
            </Tooltip>
          )}
          {onLeaveRoom && (
            <Tooltip content="ロビーに戻る" showArrow openDelay={180}>
              <IconButton
                aria-label="退出"
                onClick={onLeaveRoom}
                size="xs"
                w="36px"
                h="36px"
                bg="rgba(28,32,42,0.95)"
                color="rgba(255,255,255,0.92)"
                borderWidth="0"
                borderRadius="0"
                fontFamily="'Courier New', monospace"
                fontSize="15px"
                boxShadow="2px 2px 0 rgba(0,0,0,.65), 0 0 0 2px rgba(255,255,255,0.88)"
                _hover={{
                  bg: "rgba(52,28,28,0.98)",
                  color: "rgba(255,220,220,1)",
                  transform: "translate(0,-1px)",
                  boxShadow: "3px 3px 0 rgba(0,0,0,.7), 0 0 0 2px rgba(255,180,180,0.95)",
                }}
                _active={{
                  transform: "translate(1px,1px)",
                  boxShadow: "1px 1px 0 rgba(0,0,0,.75), 0 0 0 2px rgba(255,180,180,0.82)",
                }}
                transition="173ms cubic-bezier(.2,1,.3,1)"
              >
                <FiLogOut />
              </IconButton>
            </Tooltip>
          )}
        </HStack>
        {/* カスタムお題入力モーダル（簡易版） */}
        {/* このモーダルは外側クリック/ESCで閉じない（初心者が迷わないように明示ボタンのみ）*/}
        <Dialog.Root
          open={customOpen}
          onOpenChange={() => {
            /* no-op */
          }}
        >
          <Dialog.Backdrop />
          <Dialog.Positioner
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            zIndex={9999}
          >
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
              <Box
                p={5}
                css={{
                  borderBottom: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
                }}
              >
                <Dialog.Title>
                  <Text
                    fontSize="lg"
                    fontWeight="bold"
                    color="white"
                    fontFamily="monospace"
                  >
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
                        e.currentTarget.style.color =
                          "var(--colors-richBlack-800)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "white";
                      }}
                    >
                      やめる
                    </button>
                    <button
                      onClick={() =>
                        customText.trim() && handleSubmitCustom(customText)
                      }
                      disabled={!customText.trim()}
                      style={{
                        minWidth: "140px",
                        height: "40px",
                        borderRadius: 0,
                        fontWeight: "bold",
                        fontSize: "1rem",
                        fontFamily: "monospace",
                        border: "borders.retrogameThin",
                        background: !customText.trim()
                          ? "#666"
                          : "var(--colors-richBlack-600)",
                        color: "white",
                        cursor: !customText.trim() ? "not-allowed" : "pointer",
                        textShadow: "1px 1px 0px #000",
                        transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                        opacity: !customText.trim() ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (customText.trim()) {
                          e.currentTarget.style.background = "white";
                          e.currentTarget.style.color =
                            "var(--colors-richBlack-800)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (customText.trim()) {
                          e.currentTarget.style.background =
                            "var(--colors-richBlack-600)";
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
    </>
  );
}


