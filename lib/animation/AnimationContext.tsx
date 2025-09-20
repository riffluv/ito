"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useGPUPerformance } from "@/lib/hooks/useGPUPerformance";

export type AnimationSettings = {
  animationMode: "auto" | "3d" | "simple";
  effectiveMode: "3d" | "simple"; // 適用済み（機能ガード後）
  reducedMotion: boolean;
  gpuCapability?: "high" | "low";
  setAnimationMode: (m: "auto" | "3d" | "simple") => void;
  supports3D?: boolean; // CSS 3D/環境での3Dサポート
};

const AnimationContext = createContext<AnimationSettings | null>(null);

export function AnimationProvider({ children }: { children: React.ReactNode }) {
  const { animationMode, effectiveMode, setAnimationMode, gpuCapability } = useGPUPerformance();
  // ユーザー強制フラグ（ローカル設定）。trueなら reduced-motion を無視してアニメON。
  const [forceAnimations, setForceAnimations] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = window.localStorage.getItem("force-animations");
      if (stored === null) {
        window.localStorage.setItem("force-animations", "true");
        return true;
      }
      return stored === "true";
    } catch {
      return true;
    }
  });

  // 設定変更イベントを購読（SettingsModalから発火）
  useEffect(() => {
    const handler = () => {
      try {
        setForceAnimations(window.localStorage.getItem("force-animations") === "true");
      } catch {}
    };
    if (typeof window !== "undefined") {
      window.addEventListener("forceAnimationsChanged", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("forceAnimationsChanged", handler);
      }
    };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let params: URLSearchParams | null = null;
    try {
      params = new URLSearchParams(window.location.search || "");
    } catch {
      params = null;
    }
    if (!params) return;
    const animParam = params.get("anim");
    if (animParam !== "on" && animParam !== "off") return;
    const nextForce = animParam === "on";
    setForceAnimations(nextForce);
    try {
      window.localStorage.setItem("force-animations", nextForce ? "true" : "false");
      window.dispatchEvent(new CustomEvent("forceAnimationsChanged"));
    } catch {}
    params.delete("anim");
    const query = params.toString();
    const hash = window.location.hash || "";
    const nextUrl = window.location.pathname + (query ? "?" + query : "") + hash;
    try {
      window.history.replaceState(null, "", nextUrl);
    } catch {}
  }, []);

  const reducedMotion = useMemo(() => {
    const base =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return forceAnimations ? false : !!base;
  }, [forceAnimations]);

  // 3Dサポートの簡易フィーチャーテスト（CSS 3D + WebGLのどちらかに依存するUI向け）
  const [supports3D, setSupports3D] = useState<boolean>(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const css = (window as any).CSS;
      const cssOK = !!(css && css.supports && css.supports("transform-style", "preserve-3d"));
      const perspectiveOK = !!(css && css.supports && css.supports("perspective", "1px"));
      // 実測チェック: 実DOMに追加して 3D transform の行列が有効かを見る
      let transform3dOK = false;
      try {
        const el = document.createElement("div");
        el.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;transform:translateZ(1px);";
        document.body.appendChild(el);
        const matrix = window.getComputedStyle(el).transform;
        transform3dOK = !!(matrix && matrix !== "none");
        document.body.removeChild(el);
      } catch {}

      // supports3D は CSS 3Dの可否のみで判定（WebGL可否は背景選択で個別に制御）
      setSupports3D(Boolean(cssOK && (perspectiveOK || transform3dOK)));
    } catch {
      setSupports3D(false);
    }
  }, []);

  // 機能ガード後の適用モード
  const appliedMode: "3d" | "simple" = useMemo(() => {
    if (reducedMotion) return "simple";
    const base = effectiveMode; // auto→highなら3d, lowならsimple
    if (base === "3d" && supports3D === false) return "simple";
    return base;
  }, [effectiveMode, reducedMotion, supports3D]);

  return (
    <AnimationContext.Provider
      value={{ animationMode, effectiveMode: appliedMode, reducedMotion, forceAnimations, gpuCapability, setAnimationMode, supports3D }}
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
  return { animationMode, effectiveMode, reducedMotion, forceAnimations: true, setAnimationMode } as AnimationSettings;
}
