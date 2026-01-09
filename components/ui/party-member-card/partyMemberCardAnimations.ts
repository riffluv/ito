import { gsap } from "gsap";
import {
  CARD_BACKGROUND,
  CARD_BOX_SHADOW,
  CARD_FLASH_SHADOW,
  CLUE_FLASH_BRIGHTNESS,
} from "@/components/ui/party-member-card/partyMemberCardStyles";

export const resetCardVisualState = (node: HTMLDivElement) => {
  gsap.set(node, {
    background: CARD_BACKGROUND,
    boxShadow: CARD_BOX_SHADOW,
    filter: "brightness(1)",
    transform: "scale(1)",
    clearProps: "filter,transform",
  });
};

export const runClueFlash = (node: HTMLDivElement) => {
  const timeline = gsap
    .timeline({ defaults: { overwrite: "auto" } })
    .to(node, {
      duration: 0.18,
      filter: `brightness(${CLUE_FLASH_BRIGHTNESS})`,
      boxShadow: CARD_FLASH_SHADOW,
      ease: "power2.out",
    })
    .to(node, {
      duration: 0.28,
      filter: "brightness(1)",
      boxShadow: CARD_BOX_SHADOW,
      ease: "power3.out",
      onComplete: () => {
        gsap.set(node, { clearProps: "filter" });
      },
    });

  return timeline;
};

export const runSubmitFlash = (node: HTMLDivElement) => {
  const timeline = gsap
    .timeline({ defaults: { overwrite: "auto" } })
    .to(node, {
      duration: 0.05,
      background: "rgba(255,255,255,0.95)",
      boxShadow: CARD_FLASH_SHADOW,
      transform: "scale(1.03)",
      ease: "none",
    })
    .to(node, {
      duration: 0.03,
      background: "rgba(200,220,240,0.8)",
      transform: "scale(0.99)",
      ease: "none",
    })
    .to(node, {
      duration: 0.06,
      background: "rgba(255,245,200,0.9)",
      transform: "scale(1.02)",
      ease: "none",
    })
    .to(node, {
      duration: 0.04,
      background: "rgba(180,200,220,0.7)",
      transform: "scale(0.995)",
      ease: "none",
    })
    .to(node, {
      duration: 0.15,
      background: CARD_BACKGROUND,
      boxShadow: CARD_BOX_SHADOW,
      transform: "scale(1)",
      ease: "power2.out",
      onComplete: () => {
        gsap.set(node, { clearProps: "background,transform" });
      },
    });

  return timeline;
};

