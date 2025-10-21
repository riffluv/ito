"use client";

import { useEffect, useRef } from "react";
import type { RichBlackBackgroundController } from "@/lib/pixi/richBlackBackground";

export function RichBlackBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let controller: RichBlackBackgroundController | null = null;
    let detachResize: (() => void) | null = null;

    const init = async () => {
      if (typeof window === "undefined" || !mountRef.current) {
        return;
      }
      try {
        const { createRichBlackBackground } = await import(
          "@/lib/pixi/richBlackBackground"
        );
        if (disposed || !mountRef.current) {
          return;
        }
        const prefersReducedMotion =
          window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ??
          false;
        controller = await createRichBlackBackground({
          width: window.innerWidth,
          height: window.innerHeight,
          animate: !prefersReducedMotion,
        });
        if (!controller?.canvas || disposed || !mountRef.current) {
          controller?.destroy();
          controller = null;
          return;
        }
        mountRef.current.innerHTML = "";
        mountRef.current.appendChild(controller.canvas);
        const handleResize = () => {
          controller?.resize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", handleResize);
        detachResize = () => {
          window.removeEventListener("resize", handleResize);
        };
      } catch (error) {
        console.warn("[rich-black-bg] init failed", error);
      }
    };

    void init();

    return () => {
      disposed = true;
      detachResize?.();
      controller?.destroy();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    />
  );
}

