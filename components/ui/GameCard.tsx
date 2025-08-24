"use client";
import { Box, Text } from "@chakra-ui/react";
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
  const borderColor =
    state === "fail"
      ? "red.300"
      : state === "success"
      ? "teal.300"
      : "borderDefault";
  const ringShadow =
    state === "fail"
      ? "0 0 22px -4px rgba(229,62,62,0.65)"
      : state === "success"
      ? "0 0 18px -4px rgba(56,178,172,0.55)"
      : "0 6px 18px -4px rgba(0,0,0,0.35)";

  if (variant === "flip") {
    return (
      <Box
        style={{ perspective: "1000px" }}
        position="relative"
        w={"140px"}
        h={"180px"}
      >
        <Box
          position="absolute"
          inset={0}
          style={{ transformStyle: "preserve-3d" }}
          transition="transform 0.6s"
          transform={flipped ? "rotateY(180deg)" : "rotateY(0deg)"}
        >
          {/* Clue side */}
          <Box
            p={3}
            borderRadius={"16px"}
            bgGradient="linear(135deg,#2D3748,#1A202C)"
            borderWidth="2px"
            borderColor={borderColor}
            boxShadow={ringShadow}
            color="#E2E8F0"
            fontWeight="700"
            position="absolute"
            inset={0}
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
            p={3}
            borderRadius={"16px"}
            bgGradient={
              state === "fail"
                ? "linear(135deg,#742A2A,#E53E3E)"
                : state === "success"
                ? "linear(135deg,#38B2AC,#2C7A7B)"
                : "linear(135deg,#2D3748,#1A202C)"
            }
            borderWidth="2px"
            borderColor={borderColor}
            boxShadow={
              state === "fail"
                ? "0 0 32px -2px rgba(229,62,62,0.8)"
                : state === "success"
                ? "0 0 28px -4px rgba(56,178,172,0.8)"
                : "0 10px 35px rgba(72,187,167,0.5)"
            }
            color="#112025"
            fontWeight="900"
            position="absolute"
            inset={0}
            transform="rotateY(180deg)"
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
    <Box
      p={3}
      minW="140px"
      minH="160px"
      borderRadius="12px"
      bgGradient={
        state === "fail"
          ? "linear(180deg, rgba(220,50,50,0.45), rgba(0,0,0,0.15))"
          : state === "success"
          ? "linear(180deg, rgba(56,178,172,0.25), rgba(0,0,0,0.08))"
          : "linear(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))"
      }
      display="flex"
      flexDir="column"
      alignItems="center"
      justifyContent="center"
      border="1px solid rgba(255,255,255,0.04)"
      boxShadow={
        state === "fail"
          ? "0 0 0 2px rgba(255,80,80,0.7), 0 0 22px -4px rgba(255,80,80,0.6), inset 0 -6px 18px rgba(0,0,0,0.4)"
          : state === "success"
          ? "0 0 0 2px rgba(56,178,172,0.55), 0 0 18px -4px rgba(56,178,172,0.5), inset 0 -6px 18px rgba(0,0,0,0.25)"
          : "inset 0 -6px 18px rgba(0,0,0,0.2)"
      }
    >
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

