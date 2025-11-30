"use client";

import { Box, Text } from "@chakra-ui/react";
import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

interface PageTransitionProps {
  isTransitioning: boolean;
  direction?: "slideLeft" | "slideRight" | "slideUp" | "slideDown" | "fade" | "scale";
  fromPage?: string;
  toPage?: string;
  duration?: number;
  onComplete?: () => void;
  children?: React.ReactNode;
}

const OVERLAY_COLOR = "rgba(10, 11, 18, 0.96)";

export function PageTransition({
  isTransitioning,
  direction = "slideLeft",
  fromPage = "",
  toPage = "",
  duration = 0.6,
  onComplete,
  children,
}: PageTransitionProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotionPreference();

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    let ctx: gsap.Context | null = null;

    if (overlay) {
      ctx = gsap.context(() => {
      const clearAll = () => {
        gsap.set(overlay, { clearProps: "all" });
      };

      if (!isTransitioning) {
        clearAll();
        return;
      }

      if (shouldReduceMotion) {
        overlay.style.opacity = "0";
        onComplete?.();
        clearAll();
        return;
      }

      const baseDuration = Math.max(duration, 0.3);
      const tl = gsap.timeline({
        onComplete: () => {
          onComplete?.();
        },
      });

      switch (direction) {
        case "slideRight": {
          gsap.set(overlay, { xPercent: -100, opacity: 1 });
          tl.to(overlay, {
            xPercent: 0,
            duration: baseDuration * 0.45,
            ease: "power3.inOut",
          })
            .to({}, { duration: baseDuration * 0.15 })
            .to(overlay, {
              xPercent: 100,
              duration: baseDuration * 0.4,
              ease: "power2.in",
              onComplete: clearAll,
            });
          break;
        }
        case "slideUp": {
          gsap.set(overlay, { yPercent: 100, opacity: 1 });
          tl.to(overlay, {
            yPercent: 0,
            duration: baseDuration * 0.45,
            ease: "power3.inOut",
          })
            .to({}, { duration: baseDuration * 0.15 })
            .to(overlay, {
              yPercent: -100,
              duration: baseDuration * 0.4,
              ease: "power2.in",
              onComplete: clearAll,
            });
          break;
        }
        case "slideDown": {
          gsap.set(overlay, { yPercent: -100, opacity: 1 });
          tl.to(overlay, {
            yPercent: 0,
            duration: baseDuration * 0.45,
            ease: "power3.inOut",
          })
            .to({}, { duration: baseDuration * 0.15 })
            .to(overlay, {
              yPercent: 100,
              duration: baseDuration * 0.4,
              ease: "power2.in",
              onComplete: clearAll,
            });
          break;
        }
        case "scale": {
          gsap.set(overlay, { opacity: 0, scale: 0.92, transformOrigin: "50% 50%" });
          tl.to(overlay, {
            opacity: 1,
            duration: baseDuration * 0.25,
            ease: "power2.out",
          })
            .to(overlay, {
              scale: 1.08,
              duration: baseDuration * 0.45,
              ease: "back.inOut(1.4)",
            })
            .to(overlay, {
              opacity: 0,
              duration: baseDuration * 0.3,
              ease: "power1.out",
              onComplete: clearAll,
            });
          break;
        }
        case "slideLeft": {
          gsap.set(overlay, { xPercent: 100, opacity: 1 });
          tl.to(overlay, {
            xPercent: 0,
            duration: baseDuration * 0.45,
            ease: "power3.inOut",
          })
            .to({}, { duration: baseDuration * 0.15 })
            .to(overlay, {
              xPercent: -100,
              duration: baseDuration * 0.4,
              ease: "power2.in",
              onComplete: clearAll,
            });
          break;
        }
        default: {
          tl.fromTo(
            overlay,
            { opacity: 0 },
            { opacity: 1, duration: baseDuration * 0.35, ease: "power1.out" }
          )
            .to({}, { duration: baseDuration * 0.2 })
            .to(overlay, {
              opacity: 0,
              duration: baseDuration * 0.45,
              ease: "power1.out",
              onComplete: clearAll,
            });
        }
      }
      }, overlayRef);
    }

    return () => ctx?.revert();
  }, [isTransitioning, direction, duration, onComplete, shouldReduceMotion]);

  if (!isTransitioning) return <>{children}</>;

  return (
    <>
      {children}
      <Box
        ref={overlayRef}
        position="fixed"
        top={0}
        left={0}
        width="100vw"
        height="100vh"
        bg={OVERLAY_COLOR}
        zIndex={9998}
        pointerEvents="none"
        display="flex"
        alignItems="flex-end"
        justifyContent="flex-end"
        padding={6}
      >
        {(fromPage || toPage) && (
          <Box
            bg="rgba(0, 0, 0, 0.55)"
            border="1px solid rgba(255,255,255,0.18)"
            borderRadius={0}
            px={4}
            py={2}
          >
            <Text fontSize="xs" color="rgba(255,255,255,0.75)" fontFamily="monospace">
              {fromPage} → {toPage}
            </Text>
          </Box>
        )}
      </Box>
    </>
  );
}

export default PageTransition;
