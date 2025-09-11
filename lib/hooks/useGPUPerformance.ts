"use client";
import { useEffect, useMemo, useState } from "react";

export type GPUCapability = "high" | "low";
export type AnimationMode = "auto" | "3d" | "simple";

export interface GPUPerformanceHook {
  gpuCapability: GPUCapability;
  animationMode: AnimationMode;
  effectiveMode: "3d" | "simple";
  setAnimationMode: (mode: AnimationMode) => void;
}

const STORAGE_KEY = "gpu-animation-mode";

function detectRendererString(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    const gl2 = canvas.getContext("webgl2");
    const gl = gl2 || (canvas.getContext("webgl") as WebGLRenderingContext | null) || (canvas.getContext("experimental-webgl") as any);
    if (!gl) return null;
    const ext = (gl as any).getExtension?.("WEBGL_debug_renderer_info");
    if (ext) {
      const renderer = (gl as any).getParameter?.(ext.UNMASKED_RENDERER_WEBGL);
      if (renderer && typeof renderer === "string") return renderer;
    }
    // Fallbacks
    const fallback = (gl as any).getParameter?.((gl as any).RENDERER);
    return typeof fallback === "string" ? fallback : null;
  } catch {
    return null;
  }
}

function classifyCapability(rendererRaw: string | null): GPUCapability {
  if (!rendererRaw) return "low"; // 安全側: 低スペ扱い
  const s = rendererRaw.toLowerCase();
  // 低性能パターン
  const lowPatterns = [
    /intel\s*hd/i,
    /intel\s*uhd/i,
    /intel\s*iris/i,
    /amd.*radeon.*r[2-5]/i,
  ];
  if (lowPatterns.some((re) => re.test(s))) return "low";
  return "high";
}

export function useGPUPerformance(): GPUPerformanceHook {
  const [gpuCapability, setGpuCapability] = useState<GPUCapability>("low");
  const [animationMode, setAnimationModeState] = useState<AnimationMode>(() => {
    if (typeof window === "undefined") return "auto";
    const v = window.localStorage.getItem(STORAGE_KEY) as AnimationMode | null;
    return v || "auto";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const renderer = detectRendererString();
    setGpuCapability(classifyCapability(renderer));
  }, []);

  const setAnimationMode = (mode: AnimationMode) => {
    setAnimationModeState(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
  };

  const effectiveMode = useMemo<"3d" | "simple">(() => {
    if (animationMode === "3d") return "3d";
    if (animationMode === "simple") return "simple";
    // auto
    return gpuCapability === "high" ? "3d" : "simple";
  }, [animationMode, gpuCapability]);

  return { gpuCapability, animationMode, effectiveMode, setAnimationMode };
}

