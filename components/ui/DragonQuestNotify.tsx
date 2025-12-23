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
const MAX_VISIBLE_NOTIFICATIONS = 3;

const playNotificationSound = (type: DragonQuestNotification["type"]) => {
  playSound(NOTIFICATION_SOUND_MAP[type] ?? "notify_success");
};

class NotificationStore {
  private listeners = new Set<(notifications: DragonQuestNotification[]) => void>();
  private notifications: DragonQuestNotification[] = [];
  private timers = new Map<string, number>();
  private muteMap = new Map<string, number>();

  private normalize(value: string | undefined) {
    return (value || "")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 48);
  }

  private deriveId(notification: Omit<DragonQuestNotification, "id" | "timestamp"> & { id?: string }) {
    if (notification.id) return notification.id;
    const base = `${notification.type || "info"}-${this.normalize(notification.title)}-${this.normalize(
      notification.description
    )}`;
    return `auto-${base}`;
  }

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

  private isMuted(id: string) {
    const until = this.muteMap.get(id);
    if (!until) return false;
    if (until > Date.now()) return true;
    this.muteMap.delete(id);
    return false;
  }

  mute(id: string, duration: number) {
    const until = Date.now() + Math.max(duration, 0);
    if (!id) return;
    this.muteMap.set(id, until);
    // 既存表示も外す
    this.remove(id);
  }

  add(notification: Omit<DragonQuestNotification, "id" | "timestamp"> & { id?: string }) {
    const id = this.deriveId(notification);
    if (this.isMuted(id)) {
      this.remove(id);
      return { id, isUpdate: false, muted: true };
    }
    const timestamp = Date.now();
    const duration = notification.duration ?? DEFAULT_DURATION_MS;
    const existingIndex = this.notifications.findIndex((n) => n.id === id);
    let entry: DragonQuestNotification;

    if (existingIndex >= 0) {
      entry = {
        ...this.notifications[existingIndex],
        ...notification,
        id,
        timestamp,
      };
      this.notifications[existingIndex] = entry;
    } else {
      while (this.notifications.length >= MAX_VISIBLE_NOTIFICATIONS) {
        const oldest = this.notifications.shift();
        if (!oldest) break;
        const timer = this.timers.get(oldest.id);
        if (timer) {
          window.clearTimeout(timer);
          this.timers.delete(oldest.id);
        }
      }
      entry = {
        ...notification,
        id,
        timestamp,
      };
      this.notifications.push(entry);
    }

    this.emit();

    if (typeof window !== "undefined") {
      const prevTimer = this.timers.get(id);
      if (prevTimer) {
        window.clearTimeout(prevTimer);
      }
      const timer = window.setTimeout(() => {
        this.remove(id);
      }, duration);
      this.timers.set(id, timer);
    }

    return { id, isUpdate: existingIndex >= 0, muted: false };
  }

  remove(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      window.clearTimeout(timer);
      this.timers.delete(id);
    }
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.emit();
  }

  clear() {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.clear();
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
  const { id, isUpdate, muted } = notificationStore.add(payload);
  if (!muted && !isUpdate) {
    playNotificationSound(payload.type as DragonQuestNotification["type"]);
  }
  return muted ? null : id;
}

export function muteNotification(id: string, duration = 2000) {
  notificationStore.mute(id, duration);
}

export function muteNotifications(ids: string[], duration = 2000) {
  ids.forEach((id) => notificationStore.mute(id, duration));
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
  const accentColor = getNotificationColor(notification.type);

  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return undefined;
    const container = containerRef.current;

    if (prefersReduced) {
      gsap.set(container, { opacity: 1, x: 0, y: 0, scale: 1 });
      return undefined;
    }

    // JRPG log-style entrance: subtle slide + fade
    gsap.set(container, { opacity: 0, x: 24, y: -6, scale: 1 });

    const tl = gsap.timeline();
    tlRef.current = tl;
    tl.to(container, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.32,
      ease: "power2.out",
    });

    return () => {
      tlRef.current?.kill();
      tlRef.current = null;
      gsap.killTweensOf(container);
      gsap.set(container, { clearProps: "transform,opacity,x,y,scale" });
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

    // JRPG log-style exit: gentle fade up
    const container = containerRef.current;
    gsap.to(container, {
      y: -14,
      opacity: 0,
      duration: 0.28,
      ease: "power1.in",
      onComplete: () => onRemove(notification.id),
    });
  };

  return (
    <Box ref={containerRef} mb={3} css={{ cursor: "pointer" }} onClick={handleRemove}>
      <Box
        ref={contentRef}
        position="relative"
        bg="rgba(8,10,15,0.92)"
        border="1px solid"
        borderColor="rgba(255,255,255,0.18)"
        borderLeft="3px solid"
        borderLeftColor={accentColor}
        borderRadius="2px"
        minW="260px"
        maxW="360px"
        px={4}
        py={3}
        css={{
          boxShadow: "0 3px 10px rgba(0,0,0,0.55)",
          backdropFilter: "blur(6px)",
        }}
      >
        <Box display="flex" alignItems="flex-start" gap={3}>
          <Box
            fontSize="sm"
            flexShrink={0}
            color={accentColor}
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
              fontSize="sm"
              fontWeight={600}
              color="rgba(255,255,255,0.95)"
              letterSpacing="0.2px"
              fontFamily="var(--font-family-mono)"
              lineHeight={1.45}
              mb={notification.description ? 1.5 : 0}
            >
              {notification.title}
            </Text>

            {notification.description && (
              <Text
                fontSize="xs"
                color="rgba(255,255,255,0.7)"
                fontFamily="var(--font-family-mono)"
                lineHeight={1.6}
                letterSpacing="0.1px"
              >
                {notification.description}
              </Text>
            )}
          </Box>

          <Box
            fontSize="md"
            color="rgba(255,255,255,0.5)"
            fontFamily="var(--font-family-mono)"
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
    <Box
      position="fixed"
      top="20px"
      right="20px"
      zIndex="toast"
      css={{ pointerEvents: "auto", maxWidth: "calc(100vw - 40px)" }}
    >
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onRemove={handleRemove} />
      ))}
    </Box>
  );
}
