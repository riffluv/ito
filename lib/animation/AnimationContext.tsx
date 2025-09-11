"use client";
import React, { createContext, useContext } from "react";
import { useGPUPerformance } from "@/lib/hooks/useGPUPerformance";

export type AnimationSettings = {
  animationMode: "auto" | "3d" | "simple";
  effectiveMode: "3d" | "simple";
  reducedMotion: boolean;
  gpuCapability?: "high" | "low";
  setAnimationMode: (m: "auto" | "3d" | "simple") => void;
};

const AnimationContext = createContext<AnimationSettings | null>(null);

export function AnimationProvider({ children }: { children: React.ReactNode }) {
  const { animationMode, effectiveMode, setAnimationMode, gpuCapability } = useGPUPerformance();
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <AnimationContext.Provider
      value={{ animationMode, effectiveMode, reducedMotion, gpuCapability, setAnimationMode }}
    >
      {children}
    </AnimationContext.Provider>
  );
}

export function useAnimationSettings(): AnimationSettings {
  const ctx = useContext(AnimationContext);
  if (ctx) return ctx;
  // フォールバック: プロバイダが無い場合でも既存挙動で動作
  const { animationMode, effectiveMode, setAnimationMode } = useGPUPerformance();
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { animationMode, effectiveMode, reducedMotion, setAnimationMode };
}
