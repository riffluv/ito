import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { UI_TOKENS } from "@/theme/layout";
import { Box, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FAILURE_SUBTEXT,
  FAILURE_TITLE,
  VICTORY_SUBTEXT,
  VICTORY_TITLE,
  VictoryBurstRaysSVG,
  useBackgroundFx,
  useVictoryRaysLayer,
} from "@/components/ui/gameResultOverlaySupport";
import { useGameResultOverlayScrollLock } from "@/components/ui/game-result-overlay/useGameResultOverlayScrollLock";
import { useGameResultOverlayTimeline } from "@/components/ui/game-result-overlay/useGameResultOverlayTimeline";

declare global {
  interface Window {
    __ITO_LAST_RESULT_SOUND_AT__?: number;
  }
}

interface GameResultOverlayProps {
  failed?: boolean;
  mode?: "overlay" | "inline"; // overlay: 中央に被せる, inline: 帯として表示
  revealedAt?: unknown;
}

export function GameResultOverlay({
  failed,
  mode = "overlay",
  revealedAt,
}: GameResultOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotionPreference();
  const {
    usePixiRays: _usePixiRays,
    useSvgRays: _legacyUseSvgRays,
    pixiRaysReady,
    pixiRaysController,
    registerLineRef,
    linesRef,
    initFailed: _initFailed,
  } = useVictoryRaysLayer({ prefersReduced, mode });
  const _preferPixiRays = _usePixiRays;
  const [_webglUsable] = useState(() => {
    if (typeof document === "undefined") return false;
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { powerPreference: "high-performance" }) ||
      canvas.getContext("webgl", { powerPreference: "high-performance" }) ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  });

  // Pixi を優先し、WebGL が無い / 初期化失敗時のみ SVG を許可
  // Pixi を優先し、初期化失敗・非WebGL・Pixi非許可のときだけ SVG を使う（重複発火防止）。
  // フォールバックを無効化（常に Pixi のみ使用）。SVG は残すが参照しない。
  const useSvgRays = false;
  const triggerBackgroundFx = useBackgroundFx(prefersReduced);
  useGameResultOverlayScrollLock(mode);
  useGameResultOverlayTimeline({
    failed,
    mode,
    prefersReduced,
    triggerBackgroundFx,
    pixiRaysReady,
    pixiRaysController,
    useSvgRays,
    linesRef,
    overlayRef,
    textRef,
    containerRef,
    flashRef,
  });

  const resolveRevealTimestamp = useCallback((): number | null => {
    if (revealedAt === null || typeof revealedAt === "undefined") return null;
    if (typeof revealedAt === "number") return revealedAt;
    if (revealedAt instanceof Date) return revealedAt.getTime();
    if (typeof revealedAt === "object") {
      const value = revealedAt as {
        toMillis?: () => number;
        seconds?: number;
        nanoseconds?: number;
      };
      if (typeof value.toMillis === "function") {
        try {
          return value.toMillis();
        } catch {
          return null;
        }
      }
      if (typeof value.seconds === "number" && typeof value.nanoseconds === "number") {
        return value.seconds * 1000 + Math.floor(value.nanoseconds / 1_000_000);
      }
    }
    return null;
  }, [revealedAt]);

  const playbackKeyRef = useRef<string | null>(null);

  // サウンド再生のタイミングはGSAP Timeline の onStart で統一する
  // useEffect での呼び出しはホスト/非ホストでタイミングが異なるため削除
  // - 勝利時: Timeline l.1006 の onStart で再生
  // - 失敗時: Timeline l.646 の onStart で再生
  useEffect(() => {
    const timestamp = resolveRevealTimestamp();
    const key = `${mode}:${failed ? "fail" : "success"}:${timestamp ?? "none"}`;

    if (playbackKeyRef.current === key) {
      return;
    }

    playbackKeyRef.current = key;

    // playbackKeyRef のみ更新（再生処理は Timeline の onStart に統一）
  }, [failed, mode, resolveRevealTimestamp, revealedAt]);

  const title = failed ? FAILURE_TITLE : VICTORY_TITLE;
  const subtext = failed ? FAILURE_SUBTEXT : VICTORY_SUBTEXT;

  if (mode === "inline") {
    return (
      <Box
        color="white"
        letterSpacing={0.5}
        whiteSpace="nowrap"
        fontFamily="monospace"
        textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
        bg={UI_TOKENS.COLORS.panelBg80}
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
        borderRadius={0}
        px={4}
        py={2}
        fontWeight={700}
      >
        {title}
      </Box>
    );
  }

  return (
    <>
      {mode === "overlay" && (
        <>
          <Box
            ref={flashRef}
            position="fixed"
            inset={0}
            bg="white"
            opacity={0}
            pointerEvents="none"
            zIndex={9999}
          />
          {useSvgRays && <VictoryBurstRaysSVG registerRayRef={registerLineRef} />}
        </>
      )}

      <Box
        ref={containerRef}
        position="absolute"
        top="50%"
        left="50%"
        zIndex={10}
        // 初期ペイント時のチラ見え防止（右下に一瞬出ないよう中央原点＆非表示）
        transform="translate(-50%, -50%)"
        opacity={0}
        pointerEvents="none"
      >
        <Box
          ref={overlayRef}
          px={{ base: 6, md: 8 }}
          py={{ base: 4, md: 5 }}
          borderRadius={0}
          fontWeight={800}
          fontSize={{ base: "22px", md: "28px" }}
          color="white"
          letterSpacing={1}
          border="3px solid"
          borderColor={UI_TOKENS.COLORS.whiteAlpha90}
          css={{
            background: UI_TOKENS.COLORS.panelBg,
            boxShadow:
              "3px 3px 0 rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.6), inset 1px 1px 0 rgba(255,255,255,0.1)",
          }}
          // 初期は非表示（GSAPで表示を制御）
          opacity={0}
        >
          <Box ref={textRef} textAlign="center">
            {title}
            <Text
              fontSize={{ base: "15px", md: "17px" }}
              mt={2}
              opacity={0.9}
              fontFamily="monospace"
              fontWeight={500}
              letterSpacing="0.5px"
              textShadow="1px 1px 0px #000"
            >
              {subtext}
            </Text>
          </Box>
        </Box>
      </Box>
    </>
  );
}

