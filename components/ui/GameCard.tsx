"use client";
import { Box, Text, useSlotRecipe } from "@chakra-ui/react";

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
  const recipe = useSlotRecipe({ key: "gameCard" });
  const styles: any = recipe({ state, variant });
  // reduced motion 対応: CSS prefers-reduced-motion を利用し inner の transition を打ち消し
  const flipTransform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";

  if (variant === "flip") {
    return (
      <Box
        css={styles.container}
        role="group"
        aria-label="card"
        tabIndex={0}
        width={{ base: "{sizes.cardWBase}", md: "{sizes.cardW}" }}
        height={{ base: "{sizes.cardHBase}", md: "{sizes.cardH}" }}
        _focusVisible={{
          outline: "2px solid",
          outlineColor: "focusRing",
          outlineOffset: 2,
        }}
      >
        <Box
          css={styles.inner}
          style={{ transform: flipTransform }}
          aria-live="polite"
          className="gamecard-inner"
        >
          <Box css={styles.front}>
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
          <Box css={styles.back}>
            <Text fontSize="xs" color="fgMuted" mb={1}>
              #{typeof index === "number" ? index + 1 : "?"}
            </Text>
            <Text fontWeight="900" fontSize="3xl" textAlign="center">
              {typeof number === "number" ? number : "?"}
            </Text>
            <Text mt={2} fontSize="xs" color="fgMuted">
              {name ?? "(不明)"}
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      css={styles.frame}
      tabIndex={0}
      width={{ base: "{sizes.cardWBase}", md: "{sizes.cardW}" }}
      height={{ base: "{sizes.cardHBase}", md: "{sizes.cardH}" }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "focusRing",
        outlineOffset: 2,
      }}
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

