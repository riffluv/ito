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
  const canvas = document.createElement("canvas");
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    const gl2 = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    const gl1 =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    gl = gl2 ?? gl1;
    if (!gl) return null;

    const rendererInfo = gl.getExtension?.("WEBGL_debug_renderer_info") as
      | WEBGL_debug_renderer_info
      | null
      | undefined;
    if (rendererInfo) {
      const renderer = gl.getParameter?.(rendererInfo.UNMASKED_RENDERER_WEBGL);
      if (typeof renderer === "string") return renderer;
    }

    const rendererEnum =
      (gl as WebGLRenderingContext).RENDERER ??
      (gl as WebGL2RenderingContext).RENDERER;
    if (typeof rendererEnum === "number") {
      const fallback = gl.getParameter?.(rendererEnum);
      if (typeof fallback === "string") {
        return fallback;
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    try {
      const loseContext = gl?.getExtension?.("WEBGL_lose_context") as
        | { loseContext?: () => void }
        | null
        | undefined;
      loseContext?.loseContext?.();
    } catch {
      // ignore
    }
    canvas.width = 0;
    canvas.height = 0;
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
  const [gpuCapability, setGpuCapability] = useState<GPUCapability>("high");
  const [animationMode, setAnimationModeState] = useState<AnimationMode>(() => {
    if (typeof window === "undefined") return "auto";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as AnimationMode | null;
      if (stored === null) {
        window.localStorage.setItem(STORAGE_KEY, "auto");
        return "auto";
      }
      if (stored === "auto" || stored === "3d" || stored === "simple") {
        return stored;
      }
      window.localStorage.setItem(STORAGE_KEY, "auto");
      return "auto";
    } catch {
      return "auto";
    }
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

