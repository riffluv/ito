"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { playSound } from "@/lib/audio/playSound";
import {
  SHOWTIME_BANNER_EVENT,
  type BannerPayload,
} from "@/lib/showtime/actions";

type BannerVariant = NonNullable<BannerPayload["variant"]>;

type ActiveBanner = {
  id: number;
  text: string;
  subtext?: string;
  variant: BannerVariant;
  visible: boolean;
  duration: number;
};

const VARIANT_STYLES: Record<
  BannerVariant,
  { background: string; border: string; accent: string; heading: string; body: string }
> = {
  info: {
    background:
      "linear-gradient(135deg, rgba(42, 92, 162, 0.92), rgba(16, 26, 46, 0.94))",
    border: "rgba(120, 200, 255, 0.42)",
    accent: "rgba(142, 214, 255, 0.96)",
    heading: "rgba(232, 244, 255, 0.95)",
    body: "rgba(198, 224, 255, 0.88)",
  },
  success: {
    background:
      "linear-gradient(135deg, rgba(32, 104, 84, 0.93), rgba(16, 40, 34, 0.94))",
    border: "rgba(124, 255, 194, 0.38)",
    accent: "rgba(166, 255, 219, 0.94)",
    heading: "rgba(232, 255, 245, 0.95)",
    body: "rgba(196, 236, 214, 0.9)",
  },
  warning: {
    background:
      "linear-gradient(135deg, rgba(136, 82, 18, 0.95), rgba(48, 24, 2, 0.95))",
    border: "rgba(255, 212, 138, 0.42)",
    accent: "rgba(255, 226, 164, 0.95)",
    heading: "rgba(255, 246, 226, 0.95)",
    body: "rgba(255, 224, 188, 0.88)",
  },
  danger: {
    background:
      "linear-gradient(135deg, rgba(142, 30, 46, 0.95), rgba(50, 12, 18, 0.95))",
    border: "rgba(255, 160, 174, 0.42)",
    accent: "rgba(255, 184, 194, 0.95)",
    heading: "rgba(255, 229, 234, 0.95)",
    body: "rgba(255, 206, 213, 0.9)",
  },
};

const DEFAULT_DURATION = 2600;
type TimerHandle = number;

export function ShowtimeHUD() {
  const [banner, setBanner] = useState<ActiveBanner | null>(null);
  const hideTimerRef = useRef<TimerHandle | null>(null);
  const cleanupTimerRef = useRef<TimerHandle | null>(null);

  const triggerFeedback = useCallback((variant: BannerVariant) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        if (variant === "danger") {
          navigator.vibrate?.([0, 70, 55, 70]);
        } else if (variant === "warning") {
          navigator.vibrate?.([0, 28, 22, 28]);
        } else {
          navigator.vibrate?.(18);
        }
      } catch {
        // ignore vibration failure
      }
    }

    switch (variant) {
      case "danger":
        playSound("notify_error");
        break;
      case "warning":
        playSound("notify_warning");
        break;
      default:
        break;
    }
  }, []);

  const showBanner = useCallback((detail: BannerPayload) => {
    const variant: BannerVariant = detail.variant ?? "info";
    const id = Date.now();
    const duration = Math.max(1200, detail.durationMs ?? DEFAULT_DURATION);

    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    if (cleanupTimerRef.current) {
      window.clearTimeout(cleanupTimerRef.current);
    }

    setBanner({
      id,
      text: detail.text,
      subtext: detail.subtext,
      variant,
      visible: true,
      duration,
    });

    triggerFeedback(variant);

    hideTimerRef.current = window.setTimeout(() => {
      setBanner((prev) =>
        prev && prev.id === id ? { ...prev, visible: false } : prev
      );
    }, Math.max(400, duration - 160));

    cleanupTimerRef.current = window.setTimeout(() => {
      setBanner((prev) => (prev && prev.id === id ? null : prev));
    }, duration + 360);
  }, [triggerFeedback]);

  useEffect(() => {
    const handleBanner = (event: Event) => {
      const custom = event as CustomEvent<BannerPayload>;
      if (!custom?.detail?.text) {
        return;
      }
      showBanner(custom.detail);
    };

    window.addEventListener(
      SHOWTIME_BANNER_EVENT,
      handleBanner as EventListener
    );
    return () => {
      window.removeEventListener(
        SHOWTIME_BANNER_EVENT,
        handleBanner as EventListener
      );
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (cleanupTimerRef.current) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
    };
  }, [showBanner]);

  if (!banner) {
    return null;
  }

  const style = VARIANT_STYLES[banner.variant];

  return (
    <Box
      position="fixed"
      top={{ base: "64px", md: "72px" }}
      left={0}
      right={0}
      pointerEvents="none"
      zIndex={1300}
      display="flex"
      justifyContent="center"
      px={{ base: 4, md: 0 }}
    >
      <Box
        position="relative"
        px={{ base: 5, md: 7 }}
        py={{ base: 3, md: 4 }}
        borderRadius="18px"
        minW={{ base: "260px", md: "340px" }}
        maxW={{ base: "calc(100vw - 32px)", md: "420px" }}
        background={style.background}
        border={`1px solid ${style.border}`}
        boxShadow="0 22px 40px rgba(0, 0, 0, 0.48)"
        backdropFilter="blur(14px)"
        opacity={banner.visible ? 1 : 0}
        transform={
          banner.visible
            ? "translateY(0px) scale(1)"
            : "translateY(-28px) scale(0.97)"
        }
        transition="transform 0.35s cubic-bezier(0.24, 0.86, 0.25, 1), opacity 0.28s ease"
      >
        <Box
          position="absolute"
          inset={0}
          borderRadius="inherit"
          border="1px solid rgba(255,255,255,0.14)"
          pointerEvents="none"
        />
        <Box
          position="absolute"
          top="-8px"
          left="50%"
          transform="translateX(-50%)"
          width="64%"
          height="3px"
          background={`linear-gradient(90deg, transparent, ${style.accent}, transparent)`}
          filter="blur(1px)"
          opacity={0.85}
        />
        <Flex direction="column" gap="6px">
          <Text
            fontSize="xs"
            textTransform="uppercase"
            letterSpacing="0.32em"
            fontWeight="medium"
            color={style.accent}
          >
            Showtime
          </Text>
          <Text
            fontSize={{ base: "lg", md: "xl" }}
            fontWeight="semibold"
            color={style.heading}
            textShadow="0 0 22px rgba(0,0,0,0.45)"
            lineHeight={1.2}
          >
            {banner.text}
          </Text>
          {banner.subtext ? (
            <Text fontSize="sm" color={style.body} lineHeight={1.6}>
              {banner.subtext}
            </Text>
          ) : null}
        </Flex>
      </Box>
    </Box>
  );
}
