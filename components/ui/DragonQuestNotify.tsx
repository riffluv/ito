"use client";
import { Box, Text } from "@chakra-ui/react";
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

// 通知アイコンを取得
const getNotificationIcon = (type: string) => {
  switch (type) {
    case "success":
      return "✅";
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    default:
      return "ℹ️";
  }
};

// 通知色を取得
const getNotificationColor = (type: string) => {
  switch (type) {
    case "success":
      return "rgba(50,205,50,0.9)";
    case "error":
      return "rgba(255,69,0,0.9)";
    case "warning":
      return "rgba(255,215,0,0.9)";
    default:
      return "rgba(135,206,250,0.9)";
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

  // 登場アニメーション
  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return;

    const container = containerRef.current;
    const content = contentRef.current;

    // 初期状態
    gsap.set(container, {
      scale: 0.5,
      opacity: 0,
      x: 100,
      rotationY: 90,
    });

    // 豪華な登場アニメーション
    const tl = gsap.timeline();

    tl.to(container, {
      scale: 1.1,
      opacity: 1,
      x: 0,
      rotationY: 0,
      duration: 0.5,
      ease: "back.out(2)",
    })
      .to(container, {
        scale: 1,
        duration: 0.2,
        ease: "power2.out",
      })
      // 内容の弾み
      .to(
        content,
        {
          y: -5,
          duration: 0.1,
          ease: "power2.out",
        },
        "-=0.1"
      )
      .to(content, {
        y: 0,
        duration: 0.2,
        ease: "bounce.out",
      });
  }, []);

  // 退場アニメーション
  const handleRemove = () => {
    if (!containerRef.current) return;

    gsap.to(containerRef.current, {
      scale: 0.8,
      opacity: 0,
      x: 100,
      rotationY: -90,
      duration: 0.3,
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
        display="flex"
        alignItems="flex-start"
        gap={3}
        px={4}
        py={3}
        bg="rgba(8,9,15,0.95)"
        border="2px solid rgba(255,255,255,0.9)"
        borderRadius={0}
        minW="280px"
        maxW="360px"
        css={{
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px) saturate(1.2)",
        }}
      >
        <Text fontSize="lg" flexShrink={0}>
          {getNotificationIcon(notification.type)}
        </Text>

        <Box flex={1} minW={0}>
          <Text
            fontSize="sm"
            fontWeight={700}
            color={getNotificationColor(notification.type)}
            textShadow="1px 1px 0px #000"
            letterSpacing="0.5px"
            fontFamily="monospace"
            lineHeight={1.3}
            mb={notification.description ? 1 : 0}
          >
            {notification.title}
          </Text>

          {notification.description && (
            <Text
              fontSize="xs"
              color="white"
              textShadow="1px 1px 0px #000"
              fontFamily="monospace"
              lineHeight={1.4}
              opacity={0.9}
            >
              {notification.description}
            </Text>
          )}
        </Box>

        <Text
          fontSize="xs"
          color="rgba(255,255,255,0.5)"
          fontFamily="monospace"
          cursor="pointer"
          _hover={{ color: "white" }}
        >
          ✕
        </Text>
      </Box>
    </Box>
  );
}

// メイン通知コンテナ
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
