"use client";
import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { useEffect, useMemo, useRef, useState } from "react";

export type CardHighlightState = "default" | "success" | "fail" | "ready";

interface CardHighlightLayerProps {
  state: CardHighlightState;
  boundary?: boolean;
  successLevel?: "mild" | "final";
  isActive: boolean;
}

const COLOR_MAP: Record<CardHighlightState, { outer: string; inner: string }> = {
  default: { outer: "rgba(255,255,255,0.05)", inner: "rgba(255,255,255,0.12)" },
  ready: { outer: "rgba(180,200,255,0.22)", inner: "rgba(120,155,255,0.38)" },
  success: { outer: "rgba(250,224,120,0.24)", inner: "rgba(255,236,179,0.55)" },
  fail: { outer: "rgba(255,128,128,0.25)", inner: "rgba(255,64,64,0.45)" },
};

function pickColors(state: CardHighlightState, boundary?: boolean, successLevel?: "mild" | "final") {
  if (state === "success" && successLevel === "final") {
    return { outer: "rgba(255, 242, 200, 0.3)", inner: "rgba(255, 255, 220, 0.65)" };
  }
  if (boundary) {
    return { outer: "rgba(255, 196, 120, 0.28)", inner: "rgba(255, 216, 160, 0.52)" };
  }
  return COLOR_MAP[state] ?? COLOR_MAP.default;
}

export function CardHighlightLayer({ state, boundary = false, successLevel, isActive }: CardHighlightLayerProps) {
  const { reducedMotion, effectiveMode } = useAnimationSettings();
  const prefersSimple = reducedMotion || effectiveMode === "simple";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const colors = useMemo(() => pickColors(state, boundary, successLevel), [state, boundary, successLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(rect.width, 1);
      const height = Math.max(rect.height, 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      setSize({ width: canvas.width, height: canvas.height });
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isActive) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = size;
    if (width === 0 || height === 0) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.max(width, height) * 0.6;

    let start = performance.now();

    const drawFrame = (now: number) => {
      const t = (now - start) / 1000;
      const pulse = prefersSimple ? 0 : (Math.sin(t * 2.8) + 1) / 2; // 0..1
      const glowStrength = prefersSimple ? 0.2 : 0.25 + pulse * 0.25;
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const gradient = ctx.createRadialGradient(centerX, centerY, maxRadius * 0.2, centerX, centerY, maxRadius);
      gradient.addColorStop(0, colors.inner);
      gradient.addColorStop(0.55, `rgba(255,255,255,${glowStrength})`);
      gradient.addColorStop(1, colors.outer);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, maxRadius, maxRadius * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (!prefersSimple) {
        const rimGradient = ctx.createLinearGradient(0, 0, width, height);
        rimGradient.addColorStop(0, "rgba(255,255,255,0.12)");
        rimGradient.addColorStop(0.5, "rgba(255,255,255,0.02)");
        rimGradient.addColorStop(1, "rgba(255,255,255,0.12)");
        ctx.strokeStyle = rimGradient;
        ctx.lineWidth = Math.max(1.5 * dpr, 1);
        ctx.strokeRect(dpr, dpr, width - 2 * dpr, height - 2 * dpr);
      }

      frameRef.current = requestAnimationFrame(drawFrame);
    };

    frameRef.current = requestAnimationFrame(drawFrame);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isActive, colors, size, prefersSimple]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: isActive ? 1 : 0,
        transition: "opacity 160ms ease-out",
      }}
    />
  );
}

export default CardHighlightLayer;
