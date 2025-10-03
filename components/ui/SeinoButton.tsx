"use client";

import React from "react";
import { Box } from "@chakra-ui/react";
import { gsap } from "gsap";

import { AppButton } from "@/components/ui/AppButton";

interface SeinoButtonProps {
  isVisible: boolean;
  disabled: boolean;
  onClick: () => void | Promise<void>;
}

export function SeinoButton({ isVisible, disabled, onClick }: SeinoButtonProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      if (isVisible) {
        gsap.set(el, {
          display: "block",
          pointerEvents: disabled ? "none" : "auto",
        });
        gsap.fromTo(
          el,
          {
            x: -250,
            opacity: 0,
            rotation: -8,
            scale: 0.9,
          },
          {
            x: 0,
            opacity: 1,
            rotation: 0,
            scale: 1,
            duration: 0.45,
            ease: "back.out(2.5)",
          }
        );
        gsap.fromTo(
          el,
          {
            filter: "brightness(1)",
          },
          {
            filter: "brightness(1.4)",
            duration: 0.15,
            yoyo: true,
            repeat: 1,
            ease: "power2.inOut",
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
  }, [isVisible, disabled]);

  return (
    <Box
      ref={containerRef}
      position="fixed"
      bottom="310px"
      left="50%"
      zIndex={100}
      display="none"
    >
      <Box position="relative" transform="translateX(-50%)">
        <Box
          position="absolute"
          left="-17px"
          top="50%"
          transform="translateY(-51%) rotate(43deg)"
          w="13px"
          h="13px"
          bg="rgba(255,128,45,0.91)"
          border="2.5px solid rgba(255,255,255,0.88)"
          boxShadow="0 1px 3px rgba(0,0,0,0.5), inset -1px -1px 2px rgba(0,0,0,0.3)"
        />
        <Box
          position="absolute"
          right="-18px"
          top="50%"
          transform="translateY(-49%) rotate(46deg)"
          w="11px"
          h="11px"
          bg="rgba(248,115,30,0.88)"
          border="2.5px solid rgba(255,255,255,0.91)"
          boxShadow="0 1px 4px rgba(0,0,0,0.48), inset -1px -1px 2px rgba(0,0,0,0.28)"
        />

        <AppButton
          size="lg"
          visual="solid"
          onClick={onClick}
          disabled={disabled}
          minW="211px"
          px="34px"
          py="19px"
          position="relative"
          bg="rgba(255,128,45,0.93)"
          color="white"
          border="3px solid rgba(255,255,255,0.92)"
          borderRadius={0}
          fontWeight="800"
          fontFamily="monospace"
          fontSize="26px"
          letterSpacing="0.023em"
          textShadow="2px 3px 0px rgba(0,0,0,0.85), 1px 1px 2px rgba(0,0,0,0.6)"
          boxShadow="0 0 0 2px rgba(220,95,25,0.8), 5px 6px 0 rgba(0,0,0,.42), 4px 5px 0 rgba(0,0,0,.38), inset 0 2px 0 rgba(255,255,255,.22), inset 0 -2px 1px rgba(0,0,0,.28)"
          _before={{
            content: '""',
            position: "absolute",
            top: "3px",
            left: "4px",
            right: "3px",
            bottom: "3px",
            background:
              "linear-gradient(178deg, rgba(255,255,255,0.12) 0%, transparent 48%, rgba(0,0,0,0.18) 100%)",
            pointerEvents: "none",
          }}
          _hover={{
            bg: "rgba(255,145,65,0.96)",
            color: "white",
            textShadow: "2px 3px 0px rgba(0,0,0,0.92), 1px 2px 3px rgba(0,0,0,0.65)",
            borderColor: "rgba(255,255,255,0.95)",
            transform: "translateY(-3px)",
            boxShadow:
              "0 0 0 2px rgba(235,110,35,0.85), 6px 8px 0 rgba(0,0,0,.48), 5px 7px 0 rgba(0,0,0,.4), inset 0 2px 0 rgba(255,255,255,.28)",
          }}
          _active={{
            bg: "rgba(235,110,30,0.95)",
            color: "rgba(255,255,255,0.91)",
            boxShadow:
              "0 0 0 2px rgba(200,85,20,0.82), 2px 3px 0 rgba(0,0,0,.46), inset 0 2px 0 rgba(255,255,255,.14)",
            transform: "translateY(1px)",
          }}
          _disabled={{
            bg: "rgba(60,60,60,0.8)",
            color: "rgba(255,255,255,0.3)",
            borderColor: "rgba(255,255,255,0.4)",
            cursor: "not-allowed",
            textShadow: "1px 1px 0px #000",
            boxShadow: "0 0 0 2px rgba(40,40,40,0.8), 2px 3px 0 rgba(0,0,0,.3)",
            transform: "none",
          }}
        >
          せーの！
        </AppButton>
      </Box>
    </Box>
  );
}
