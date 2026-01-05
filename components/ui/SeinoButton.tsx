"use client";

import React from "react";
import { Box } from "@chakra-ui/react";
import { gsap } from "gsap";
import { keyframes } from "@emotion/react";

import { AppButton } from "@/components/ui/AppButton";
import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { SEINO_BUTTON_STYLES } from "./seinoButtonStyles";

// せーのボタン固有のフレア
const orangeGlowSeino = keyframes`
  0% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(220,95,25,0.8), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.22), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("20px")} rgba(255,145,65,0.4);
  }
  35% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(235,110,40,0.88), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.26), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("28px")} rgba(255,165,85,0.55);
  }
  65% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(245,120,50,0.92), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.28), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("32px")} rgba(255,175,95,0.65);
  }
  100% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(220,95,25,0.8), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.22), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("20px")} rgba(255,145,65,0.4);
  }
`;

interface SeinoButtonProps {
  isVisible: boolean;
  disabled: boolean;
  onClick: () => void | Promise<void>;
}

export function SeinoButton({ isVisible, disabled, onClick }: SeinoButtonProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return () => {};
    }

    const ctx = gsap.context(() => {
      if (isVisible) {
        gsap.set(el, {
          display: "block",
        });
        gsap.fromTo(
          el,
          {
            x: -250,
            opacity: 0,
            rotation: -3,
            scale: 0.92,
          },
          {
            x: 0,
            opacity: 1,
            rotation: 0,
            scale: 1,
            duration: 0.42,
            ease: "cubic-bezier(.18,.95,.28,1.08)",
          }
        );
        gsap.fromTo(
          el,
          {
            filter: "brightness(1)",
          },
          {
            filter: "brightness(1.15)",
            duration: 0.14,
            yoyo: true,
            repeat: 1,
            ease: "cubic-bezier(.4,.1,.6,.9)",
          }
        );
      } else {
        gsap.set(el, {
          display: "none",
          pointerEvents: "none",
          x: 0,
          opacity: 0,
          rotation: 0,
          scale: 1,
          filter: "brightness(1)",
        });
      }
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, [isVisible]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    try {
      gsap.set(el, { pointerEvents: !isVisible || disabled ? "none" : "auto" });
    } catch {
      // ignore gsap failures
    }
  }, [disabled, isVisible]);

  return (
    <Box
      ref={containerRef}
      position="fixed"
      bottom={scaleForDpi("310px")}
      left="50%"
      zIndex={100}
      display="none"
    >
      <Box position="relative" transform="translateX(-50%)">
        <Box
          position="absolute"
          left={scaleForDpi("-17px")}
          top="50%"
          transform="translateY(-51%) rotate(38deg)"
          w={scaleForDpi("13px")}
          h={scaleForDpi("13px")}
          bg="rgba(255,128,45,0.91)"
          border={`${scaleForDpi("3px")} solid rgba(255,255,255,0.88)`}
          boxShadow={`${scaleForDpi("1px")} ${scaleForDpi("2px")} 0 rgba(0,0,0,0.55), inset ${scaleForDpi("-1px")} ${scaleForDpi("-1px")} ${scaleForDpi("1px")} rgba(0,0,0,0.32)`}
        />
        <Box
          position="absolute"
          right={scaleForDpi("-18px")}
          top="50%"
          transform="translateY(-49%) rotate(52deg)"
          w={scaleForDpi("11px")}
          h={scaleForDpi("11px")}
          bg="rgba(248,115,30,0.88)"
          border={`${scaleForDpi("3px")} solid rgba(255,255,255,0.91)`}
          boxShadow={`${scaleForDpi("2px")} ${scaleForDpi("1px")} 0 rgba(0,0,0,0.52), inset ${scaleForDpi("-1px")} ${scaleForDpi("-1px")} ${scaleForDpi("1px")} rgba(0,0,0,0.3)`}
        />

        <AppButton
          {...SEINO_BUTTON_STYLES}
          size="lg"
          visual="solid"
          onClick={onClick}
          disabled={disabled}
          css={{
            animation: `${orangeGlowSeino} 2.9s cubic-bezier(.35,.12,.65,.88) infinite`,
          }}
        >
          せーの！
        </AppButton>
      </Box>
    </Box>
  );
}
