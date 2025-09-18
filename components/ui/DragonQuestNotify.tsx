"use client";
import { Box, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { gsap } from "gsap";
import { useEffect, useRef, useState } from "react";

export interface DragonQuestNotification {
  id: string;
  title: string;
  description?: string;
  type: "info" | "warning" | "success" | "error";
  duration?: number;
  timestamp: number;
}

// グローバル通知ストア
class NotificationStore {
  private listeners: Set<(notifications: DragonQuestNotification[]) => void> =
    new Set();
  private notifications: DragonQuestNotification[] = [];

  subscribe(listener: (notifications: DragonQuestNotification[]) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.notifications]));
  }

  add(notification: Omit<DragonQuestNotification, "id" | "timestamp">) {
    const newNotification: DragonQuestNotification = {
      ...notification,
      id: `dq-notify-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };

    this.notifications.push(newNotification);
    this.notify();

    // 自動削除
    const duration = notification.duration ?? 4000;
    setTimeout(() => {
      this.remove(newNotification.id);
    }, duration);

    return newNotification.id;
  }

  remove(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.notify();
  }

  clear() {
    this.notifications = [];
    this.notify();
  }
}

export const notificationStore = new NotificationStore();

// ドラクエ風通知の外観関数
export function dragonQuestNotify(options: {
  title: string;
  description?: string;
  type?: "info" | "warning" | "success" | "error";
  duration?: number;
}) {
  return notificationStore.add({
    type: "info",
    ...options,
  });
}

// ドラクエ風ピクセルアイコンを取得
const getNotificationIcon = (type: string) => {
  switch (type) {
    case "success":
      return "◆"; // ダイヤモンド：成功の宝石
    case "error":
      return "■"; // 四角：警告の盾
    case "warning":
      return "▲"; // 三角：注意マーク
    default:
      return "●"; // 丸：一般的な情報
  }
};

// 通知色を取得
const getNotificationColor = (type: string) => {
  switch (type) {
    case "success":
      return UI_TOKENS.COLORS.limeGreen;
    case "error":
      return UI_TOKENS.COLORS.orangeRed;
    case "warning":
      return UI_TOKENS.COLORS.accentGold;
    default:
      return UI_TOKENS.COLORS.skyBlue;
  }
};

// 個別通知コンポーネント
function NotificationItem({
  notification,
  onRemove,
}: {
  notification: DragonQuestNotification;
  onRemove: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<any>(null);
  const prefersReduced = useReducedMotionPreference();

  // ドラクエ風シンプルな登場アニメーション
  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return;

    const container = containerRef.current;
    const content = contentRef.current;

    if (prefersReduced) {
      // 最小限の状態をセットしてアニメーションをスキップ
      gsap.set(container, { opacity: 1, y: 0 });
      gsap.set(content, { y: 0 });
      return;
    }

    // 初期状態：上からスライドイン（ドラクエのメッセージボックス風）
    gsap.set(container, {
      opacity: 0,
      y: -20,
    });

    // コンテンツも初期状態で非表示
    gsap.set(content, {
      opacity: 0.3,
    });

    // シンプルなスライドイン
    const tl = gsap.timeline();
    tlRef.current = tl;

    tl.to(container, {
      opacity: 1,
      y: 0,
      duration: 0.18,
      ease: "power2.out",
    })
      // 内容のタイピング風演出（ピクセルゲーム風）
      .to(
        content,
        {
          opacity: 1,
          duration: 0.12,
          ease: "none",
        },
        "-=0.06"
      );

    return () => {
      // クリーンアップ
      try {
        if (tlRef.current) {
          tlRef.current.kill();
          tlRef.current = null;
        }
        gsap.killTweensOf(container);
        gsap.killTweensOf(content);
        gsap.set(container, {
          clearProps: "transform,opacity,y",
        });
        gsap.set(content, { clearProps: "opacity" });
      } catch (e) {
        // ignore
      }
    };
  }, [prefersReduced]);

  // ドラクエ風シンプルな退場アニメーション
  const handleRemove = () => {
    if (!containerRef.current) return;

    gsap.to(containerRef.current, {
      opacity: 0,
      y: -10,
      duration: 0.15,
      ease: "power2.in",
      onComplete: () => onRemove(notification.id),
    });
  };

  // 自動削除タイマー
  useEffect(() => {
    const duration = notification.duration ?? 4000;
    const timer = setTimeout(handleRemove, duration);
    return () => clearTimeout(timer);
  }, [notification.duration, notification.id]);

  return (
    <Box
      ref={containerRef}
      mb={3}
      css={{
        cursor: "pointer",
      }}
      onClick={handleRemove}
    >
      <Box
        ref={contentRef}
        position="relative"
        bg={UI_TOKENS.COLORS.panelBg}
        border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
        borderRadius={0}
        minW="320px"
        maxW="400px"
        px={5}
        py={4}
        css={{
          // ドラクエ風ピクセルシャドウ（blur無し、段積み）
          boxShadow: `
            3px 3px 0 rgba(0,0,0,0.8),
            6px 6px 0 rgba(0,0,0,0.6),
            inset 1px 1px 0 rgba(255,255,255,0.3),
            inset -1px -1px 0 rgba(0,0,0,0.5)
          `,
          // ドラクエ風の微ノイズテクスチャ
          backgroundImage: `
            radial-gradient(circle at 20% 80%, rgba(255,255,255,0.02) 1px, transparent 1px),
            radial-gradient(circle at 80% 20%, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '8px 8px, 12px 12px',
          // モダンなガラス効果を除去
          backdropFilter: "none",
        }}
      >
        <Box display="flex" alignItems="flex-start" gap={4}>
          <Box
            fontSize="lg"
            flexShrink={0}
            color={getNotificationColor(notification.type)}
            textShadow="2px 2px 0px #000, 0 0 4px rgba(0,0,0,0.8)"
            fontFamily="monospace"
            fontWeight="bold"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="24px"
            h="24px"
          >
            {getNotificationIcon(notification.type)}
          </Box>

          <Box flex={1} minW={0}>
            <Text
              fontSize="md"
              fontWeight={700}
              color="white"
              textShadow="2px 2px 0px #000, 0 0 6px rgba(0,0,0,0.9)"
              letterSpacing="1px"
              fontFamily="monospace"
              lineHeight={1.4}
              mb={notification.description ? 2 : 0}
            >
              {notification.title}
            </Text>

            {notification.description && (
              <Text
                fontSize="sm"
                color={UI_TOKENS.COLORS.whiteAlpha90}
                textShadow="1px 1px 0px #000, 0 0 4px rgba(0,0,0,0.7)"
                fontFamily="monospace"
                lineHeight={1.5}
                letterSpacing="0.5px"
              >
                {notification.description}
              </Text>
            )}
          </Box>

          <Box
            fontSize="md"
            color={UI_TOKENS.COLORS.whiteAlpha60}
            fontFamily="monospace"
            cursor="pointer"
            _hover={{
              color: "white",
              textShadow: "1px 1px 0px #000"
            }}
            fontWeight="bold"
            w="20px"
            h="20px"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            ×
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// メイン通知コンテナ（ドラクエ風メッセージウィンドウ位置）
export function DragonQuestNotifyContainer() {
  const [notifications, setNotifications] = useState<DragonQuestNotification[]>(
    []
  );

  useEffect(() => {
    const unsubscribe = notificationStore.subscribe(setNotifications);
    return unsubscribe;
  }, []);

  const handleRemove = (id: string) => {
    notificationStore.remove(id);
  };

  if (notifications.length === 0) return null;

  return (
    <Box
      position="fixed"
      top="24px"
      right="24px"
      zIndex="toast"
      css={{
        pointerEvents: "auto",
      }}
    >
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={handleRemove}
        />
      ))}
    </Box>
  );
}
