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

const NOTIFICATION_ICON_MAP: Record<DragonQuestNotification["type"], string> = {
  success: "✨",
  error: "💥",
  warning: "⚠️",
  info: "🔔",
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
        bg={UI_TOKENS.COLORS.panelBg}
        border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
        borderRadius={0}
        minW="320px"
        maxW="400px"
        px={5}
        py={4}
        css={{
          boxShadow:
            "3px 3px 0 rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.6), inset 1px 1px 0 rgba(255,255,255,0.3), inset -1px -1px 0 rgba(0,0,0,0.5)",
          backgroundImage:
            "radial-gradient(circle at 20% 80%, rgba(255,255,255,0.02) 1px, transparent 1px), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "8px 8px, 12px 12px",
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
            _hover={{ color: "white", textShadow: "1px 1px 0px #000" }}
            fontWeight={700}
            w="20px"
            h="20px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            aria-label="通知を閉じる"
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
