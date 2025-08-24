"use client";
import { Box, Text } from "@chakra-ui/react";
import { gameCardRecipe } from "../../theme/recipes/gameCard";
import React from "react";

export type GameCardProps = {
  index?: number | null;
  name?: string;
  clue?: string;
  number?: number | null;
  state?: "default" | "success" | "fail";
  variant?: "flat" | "flip"; // flip は sort-submit の公開演出用
  flipped?: boolean; // variant=flip のときに数値面を表示するか
};

export function GameCard({
  index,
  name,
  clue,
  number,
  state = "default",
  variant = "flat",
  flipped = false,
}: GameCardProps) {
  const recipe = gameCardRecipe({ state, variant });

  if (variant === "flip") {
    return (
      <Box style={(recipe as any).container} position="relative" w="140px" h="180px">
        <Box
          position="absolute"
          inset={0}
          style={{ ...(recipe as any).inner, transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          {/* Clue side */}
          <Box
            p={(recipe as any).front?.p}
            borderRadius={(recipe as any).front?.borderRadius}
            bgGradient={(recipe as any).front?.bgGradient}
            borderWidth={(recipe as any).front?.borderWidth}
            borderColor={(recipe as any).front?.borderColor}
            boxShadow={(recipe as any).front?.boxShadow}
            color={(recipe as any).front?.color}
            fontWeight={(recipe as any).front?.fontWeight}
            position={(recipe as any).front?.position}
            inset={(recipe as any).front?.inset}
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            <Text fontSize="xs" color="fgMuted" mb={1}>
              #{typeof index === "number" ? index + 1 : "?"}
            </Text>
            <Text fontWeight="900" fontSize="md" textAlign="center">
              {clue || "(連想なし)"}
            </Text>
            <Text mt={2} fontSize="xs" color="fgMuted">
              {name ?? "(不明)"}
            </Text>
          </Box>

          {/* Number side */}
          <Box
            p={(recipe as any).back?.p}
            borderRadius={(recipe as any).back?.borderRadius}
            bgGradient={(recipe as any).back?.bgGradient}
            borderWidth={(recipe as any).back?.borderWidth}
            borderColor={(recipe as any).back?.borderColor}
            boxShadow={(recipe as any).back?.boxShadow}
            color={(recipe as any).back?.color}
            fontWeight={(recipe as any).back?.fontWeight}
            position={(recipe as any).back?.position}
            inset={(recipe as any).back?.inset}
            transform={(recipe as any).back?.transform}
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            <Text fontSize="xs" color="rgba(0,0,0,0.55)" mb={1}>
              #{typeof index === "number" ? index + 1 : "?"}
            </Text>
            <Text fontWeight="900" fontSize="3xl" textAlign="center">
              {typeof number === "number" ? number : "?"}
            </Text>
            <Text mt={2} fontSize="xs" color="rgba(0,0,0,0.6)">
              {name ?? "(不明)"}
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // flat variant
  return (
    <Box p={(recipe as any).frame?.p} minW={(recipe as any).frame?.minW} minH={(recipe as any).frame?.minH} borderRadius={(recipe as any).frame?.borderRadius} bgGradient={(recipe as any).frame?.bgGradient} display={(recipe as any).frame?.display} flexDir={(recipe as any).frame?.flexDirection} alignItems={(recipe as any).frame?.alignItems} justifyContent={(recipe as any).frame?.justifyContent} border={(recipe as any).frame?.border} boxShadow={(recipe as any).frame?.boxShadow}>
      {typeof index === "number" && (
        <Text fontSize="sm" color="fgMuted">
          #{index + 1}
        </Text>
      )}
      <Text fontWeight="900" fontSize="xl" textAlign="center">
        {typeof number === "number" ? number : clue || "?"}
      </Text>
      <Text mt={2} fontSize="xs" color="fgMuted">
        {name ?? "(不明)"}
      </Text>
    </Box>
  );
}

export default GameCard;
