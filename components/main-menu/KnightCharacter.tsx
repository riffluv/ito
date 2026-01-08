"use client";

import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { Image } from "@chakra-ui/react";

export function KnightCharacter() {
  const knightImage = "/images/knight1.webp";
  const knightAlt = "序の紋章III Male Knight";

  return (
    <Image
      src={knightImage}
      alt={knightAlt}
      boxSize={{ base: "16", md: "20", lg: "24" }}
      objectFit="contain"
      filter="drop-shadow(0 6px 16px rgba(0,0,0,0.6))"
      css={{
        // Dragon Quest-style: pixel art friendly size
        imageRendering: "pixelated", // Keep crisp pixel art
        "@container (max-width: 600px)": {
          width: scaleForDpi("3.5rem"), // 56px for mobile
          height: scaleForDpi("3.5rem"),
        },
        "@container (min-width: 600px) and (max-width: 900px)": {
          width: scaleForDpi("4.5rem"), // 72px for tablet
          height: scaleForDpi("4.5rem"),
        },
        "@container (min-width: 900px)": {
          width: scaleForDpi("6rem"), // 96px for desktop
          height: scaleForDpi("6rem"),
        },
      }}
    />
  );
}

