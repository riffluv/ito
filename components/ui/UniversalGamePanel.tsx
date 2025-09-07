"use client";
import { Box, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

// ドラクエ風フェーズアナウンス
const getPhaseInfo = (status: string) => {
  switch (status) {
    case "waiting":
      return { text: "ゲーム準備中", icon: "⏳", color: "rgba(255,215,0,0.9)" }; // ゴールド
    case "clue": 
      return { text: "連想ワードを考えよう", icon: "💭", color: "rgba(135,206,250,0.9)" }; // スカイブルー
    case "playing":
      return { text: "順番に並べよう", icon: "🎯", color: "rgba(255,69,0,0.9)" }; // 赤オレンジ
    case "reveal":
      return { text: "カードをめくっています", icon: "👀", color: "rgba(147,112,219,0.9)" }; // パープル
    case "finished":
      return { text: "結果発表！", icon: "🎉", color: "rgba(50,205,50,0.9)" }; // ライムグリーン
    default:
      return { text: "ゲーム進行中", icon: "⚡", color: "rgba(255,255,255,0.9)" }; // ホワイト
  }
};

interface NotificationInfo {
  id: string;
  text: string;
  type: "success" | "info" | "warning" | "error";
  timestamp: number;
}

interface UniversalGamePanelProps {
  roomStatus: string;
}

export function UniversalGamePanel({
  roomStatus
}: UniversalGamePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  
  const previousStatus = useRef<string>(roomStatus);

  const phaseInfo = getPhaseInfo(roomStatus);

  // フェーズ変更時の特別なアニメーション
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    if (previousStatus.current !== roomStatus) {
      // フェーズ変更時の豪華なエフェクト
      const tl = gsap.timeline();
      
      tl.to(container, {
        scale: 1.1,
        rotationY: 5,
        duration: 0.2,
        ease: "power2.out"
      })
      .to(container, {
        scale: 1,
        rotationY: 0,
        duration: 0.3,
        ease: "elastic.out(1, 0.8)"
      })
      // 色変更のパルス効果
      .to(container, {
        filter: "brightness(1.3)",
        duration: 0.1
      }, "-=0.2")
      .to(container, {
        filter: "brightness(1)",
        duration: 0.2
      });
    }

    previousStatus.current = roomStatus;
  }, [roomStatus]);

  // プレイヤー数変更時のアニメーション
  useEffect(() => {
    if (!containerRef.current) return;

    if (previousPlayerCount.current !== playerCount) {
      // プレイヤー数変更時の軽いバウンス
      gsap.to(containerRef.current, {
        scale: 1.03,
        duration: 0.1,
        ease: "power2.out",
        yoyo: true,
        repeat: 1
      });
    }

    previousPlayerCount.current = playerCount;
  }, [playerCount]);

  // 定期的にプレイヤー情報を表示
  useEffect(() => {
    const interval = setInterval(() => {
      if (displayMode === "phase") {
        setDisplayMode("players");
        setTimeout(() => {
          setDisplayMode("phase");
        }, 2000);
      }
    }, 8000); // 8秒ごと

    return () => clearInterval(interval);
  }, [displayMode]);

  // 通知の色を取得
  const getNotificationColor = (type: string) => {
    switch (type) {
      case "success": return "rgba(50,205,50,0.9)";
      case "error": return "rgba(255,69,0,0.9)";
      case "warning": return "rgba(255,215,0,0.9)";
      default: return "rgba(135,206,250,0.9)";
    }
  };

  // 初期表示アニメーション
  useEffect(() => {
    if (!containerRef.current) return;

    gsap.set(containerRef.current, { 
      scale: 0.5, 
      opacity: 0, 
      rotationY: -90 
    });
    
    gsap.to(containerRef.current, {
      scale: 1,
      opacity: 1,
      rotationY: 0,
      duration: 0.8,
      ease: "back.out(2)",
      delay: 0.3
    });
  }, []);

  return (
    <Box
      ref={containerRef}
      position="fixed"
      top={{ base: "20px", md: "24px" }}
      left={{ base: "20px", md: "24px" }}
      zIndex={100}
      css={{
        pointerEvents: "none",
      }}
    >
      <Box
        minW="280px"
        maxW="400px"
        bg="rgba(8,9,15,0.95)"
        border="3px solid rgba(255,255,255,0.9)"
        borderRadius={0}
        css={{
          boxShadow: "inset 0 3px 0 rgba(255,255,255,0.08), inset 0 -3px 0 rgba(0,0,0,0.4), 0 12px 24px rgba(0,0,0,0.5)",
          backdropFilter: "blur(12px) saturate(1.2)",
        }}
      >
        {/* フェーズ表示 */}
        <Box
          ref={phaseRef}
          p={4}
          position="absolute"
          top={0}
          left={0}
          right={0}
        >
          <Box display="flex" alignItems="center" gap={3}>
            <Text fontSize="xl" display="inline-block">
              {phaseInfo.icon}
            </Text>
            <Box flex={1}>
              <Text
                fontSize={{ base: "sm", md: "md" }}
                fontWeight={700}
                color={phaseInfo.color}
                textShadow="1px 1px 0px #000"
                letterSpacing="0.5px"
                fontFamily="monospace"
                lineHeight={1.2}
              >
                ▼ {phaseInfo.text} ▼
              </Text>
            </Box>
          </Box>
        </Box>

        {/* プレイヤー情報表示 */}
        <Box
          ref={playersRef}
          p={4}
          position="absolute"
          top={0}
          left={0}
          right={0}
        >
          <Box display="flex" alignItems="center" gap={3}>
            <Text fontSize="xl">👥</Text>
            <Box flex={1}>
              <Text
                fontSize={{ base: "sm", md: "md" }}
                fontWeight={700}
                color="rgba(135,206,250,0.9)"
                textShadow="1px 1px 0px #000"
                letterSpacing="0.5px"
                fontFamily="monospace"
                lineHeight={1.2}
              >
                プレイヤー: {playerCount}/{maxPlayers}
                {onlineCount !== undefined && (
                  <Text as="span" fontSize="xs" color="rgba(255,255,255,0.7)" ml={2}>
                    (オンライン: {onlineCount})
                  </Text>
                )}
              </Text>
            </Box>
          </Box>
        </Box>

        {/* 通知表示 */}
        <Box
          ref={notificationRef}
          p={4}
          position="absolute"
          top={0}
          left={0}
          right={0}
        >
          {currentNotification && (
            <Box display="flex" alignItems="center" gap={3}>
              <Text fontSize="xl">
                {currentNotification.type === "success" ? "✅" : 
                 currentNotification.type === "error" ? "❌" :
                 currentNotification.type === "warning" ? "⚠️" : "ℹ️"}
              </Text>
              <Box flex={1}>
                <Text
                  fontSize={{ base: "sm", md: "md" }}
                  fontWeight={700}
                  color={getNotificationColor(currentNotification.type)}
                  textShadow="1px 1px 0px #000"
                  letterSpacing="0.5px"
                  fontFamily="monospace"
                  lineHeight={1.2}
                >
                  {currentNotification.text}
                </Text>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}