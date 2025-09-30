"use client";
import { Box, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { gsap } from "gsap";
import { playSound } from "@/lib/audio/playSound";
import type { SoundId } from "@/lib/audio/types";
import { useEffect, useRef, useState } from "react";

export interface DragonQuestNotification {
  id: string;
  title: string;
  description?: string;
  type: "info" | "warning" | "success" | "error";
  duration?: number;
  timestamp: number;
}

const NOTIFICATION_SOUND_MAP: Record<DragonQuestNotification["type"], SoundId> = {
  info: "notify_success",
  success: "notify_success",
  warning: "notify_warning",
  error: "notify_error",
};

// Octopath Traveler-style: simple symbols, no emojis
const NOTIFICATION_ICON_MAP: Record<DragonQuestNotification["type"], string> = {
  success: "▶",
  error: "▶",
  warning: "▶",
  info: "▶",
};

const DEFAULT_DURATION_MS = 5500;

const playNotificationSound = (type: DragonQuestNotification["type"]) => {
  playSound(NOTIFICATION_SOUND_MAP[type] ?? "notify_success");
};

class NotificationStore {
  private listeners = new Set<(notifications: DragonQuestNotification[]) => void>();
  private notifications: DragonQuestNotification[] = [];

  subscribe(listener: (notifications: DragonQuestNotification[]) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const snapshot = [...this.notifications];
    this.listeners.forEach((listener) => listener(snapshot));
  }

  add(notification: Omit<DragonQuestNotification, "id" | "timestamp"> & { id?: string }) {
    const id = notification.id || `dq-notify-${Date.now()}-${Math.random()}`;
    // 既存の同一IDがあれば置き換え（重複防止）
    this.notifications = this.notifications.filter((n) => n.id !== id);

    const entry: DragonQuestNotification = {
      ...notification,
      id,
      timestamp: Date.now(),
    };
    this.notifications.push(entry);
    this.emit();

    const duration = notification.duration ?? DEFAULT_DURATION_MS;
    const timer = window.setTimeout(() => {
      this.remove(entry.id);
    }, duration);

    return entry.id;
  }

  remove(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.emit();
  }

  clear() {
    this.notifications = [];
    this.emit();
  }
}

export const notificationStore = new NotificationStore();

export function dragonQuestNotify(options: {
  id?: string;
  title: string;
  description?: string;
  type?: "info" | "warning" | "success" | "error";
  duration?: number;
}) {
  const payload: Omit<DragonQuestNotification, "id" | "timestamp"> & { id?: string } = {
    type: options.type ?? "info",
    ...options,
  };
  const id = notificationStore.add(payload);
  playNotificationSound(payload.type as DragonQuestNotification["type"]);
  return id;
}

const getNotificationIcon = (type: DragonQuestNotification["type"]) =>
  NOTIFICATION_ICON_MAP[type] ?? NOTIFICATION_ICON_MAP.info;

const getNotificationColor = (type: DragonQuestNotification["type"]) => {
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

function NotificationItem({
  notification,
  onRemove,
}: {
  notification: DragonQuestNotification;
  onRemove: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const prefersReduced = useReducedMotionPreference();

  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return;
    const container = containerRef.current;
    const content = contentRef.current;

    if (prefersReduced) {
      gsap.set(container, { opacity: 1, x: 0, scale: 1 });
      gsap.set(content, { opacity: 1 });
      return;
    }

    // Octopath Traveler-style HD-2D entrance
    gsap.set(container, { opacity: 0, x: 80, scale: 1.08 });
    gsap.set(content, { opacity: 0.3 });

    const tl = gsap.timeline();
    tlRef.current = tl;
    tl.to(container, {
      opacity: 1,
      x: 0,
      scale: 1,
      duration: 0.5,
      ease: "power2.out",
    }).to(
      content,
      {
        opacity: 1,
        duration: 0.18,
        ease: "power1.out",
      },
      "-=0.32"
    );

    return () => {
      tlRef.current?.kill();
      tlRef.current = null;
      gsap.killTweensOf(container);
      gsap.killTweensOf(content);
      gsap.set(container, { clearProps: "transform,opacity,x,scale" });
      gsap.set(content, { clearProps: "opacity" });
    };
  }, [prefersReduced]);

  useEffect(() => {
    const duration = notification.duration ?? DEFAULT_DURATION_MS;
    const timer = window.setTimeout(() => onRemove(notification.id), duration);
    return () => window.clearTimeout(timer);
  }, [notification.duration, notification.id, onRemove]);

  const handleRemove = () => {
    if (!containerRef.current) {
      onRemove(notification.id);
      return;
    }

    // Octopath Traveler-style HD-2D exit: float up + fade out
    const container = containerRef.current;
    gsap.to(container, {
      y: -30,
      opacity: 0,
      scale: 0.95,
      duration: 0.35,
      ease: "power2.in",
      onComplete: () => onRemove(notification.id),
    });
  };

  return (
    <Box ref={containerRef} mb={3} css={{ cursor: "pointer" }} onClick={handleRemove}>
      <Box
        ref={contentRef}
        position="relative"
        bg="rgba(12,14,20,0.92)"
        border="2px solid rgba(255,255,255,0.85)"
        borderRadius={0}
        minW="320px"
        maxW="400px"
        px={5}
        py={3.5}
        css={{
          boxShadow:
            "0 4px 16px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
          backdropFilter: "blur(8px)",
          background:
            "linear-gradient(135deg, rgba(12,14,20,0.95) 0%, rgba(18,20,28,0.92) 100%)",
        }}
      >
        <Box display="flex" alignItems="flex-start" gap={3}>
          <Box
            fontSize="sm"
            flexShrink={0}
            color="rgba(255,255,255,0.9)"
            fontFamily="monospace"
            fontWeight="normal"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="16px"
            h="20px"
            mt="2px"
          >
            {getNotificationIcon(notification.type)}
          </Box>

          <Box flex={1} minW={0}>
            <Text
              fontSize="md"
              fontWeight={600}
              color="rgba(255,255,255,0.95)"
              textShadow="0 1px 2px rgba(0,0,0,0.5)"
              letterSpacing="0.3px"
              fontFamily="system-ui, -apple-system, sans-serif"
              lineHeight={1.5}
              mb={notification.description ? 1.5 : 0}
            >
              {notification.title}
            </Text>

            {notification.description && (
              <Text
                fontSize="sm"
                color="rgba(255,255,255,0.7)"
                textShadow="0 1px 2px rgba(0,0,0,0.4)"
                fontFamily="system-ui, -apple-system, sans-serif"
                lineHeight={1.6}
                letterSpacing="0.2px"
              >
                {notification.description}
              </Text>
            )}
          </Box>

          <Box
            fontSize="lg"
            color="rgba(255,255,255,0.5)"
            fontFamily="system-ui, sans-serif"
            cursor="pointer"
            _hover={{ color: "rgba(255,255,255,0.9)" }}
            fontWeight={300}
            w="20px"
            h="20px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            aria-label="通知を閉じる"
            transition="color 0.2s ease"
          >
            ×
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export function DragonQuestNotifyContainer() {
  const [notifications, setNotifications] = useState<DragonQuestNotification[]>([]);

  useEffect(() => {
    const unsubscribe = notificationStore.subscribe(setNotifications);
    return unsubscribe;
  }, []);

  const handleRemove = (id: string) => {
    notificationStore.remove(id);
  };

  if (notifications.length === 0) return null;

  return (
    <Box position="fixed" top="24px" right="24px" zIndex="toast" css={{ pointerEvents: "auto" }}>
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onRemove={handleRemove} />
      ))}
    </Box>
  );
}
