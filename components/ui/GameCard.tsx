"use client";
import { CARD_FLIP_EASING, HOVER_EASING } from "@/lib/ui/motion";
import { useState } from "react";

export type GameCardProps = {
  index?: number | null;
  name?: string;
  clue?: string;
  number?: number | null;
  state?: "default" | "success" | "fail";
  variant?: "flat" | "flip";
  flipped?: boolean;
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
  const [isHovered, setIsHovered] = useState(false);

  // 3D FLIP CARD IMPLEMENTATION - 以前の動作していたバージョンを復活
  if (variant === "flip") {
    const hoverTransform = isHovered ? "translateY(-4px)" : "translateY(0)";
    const flipTransform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";

    return (
      <div
        style={{
          perspective: "1000px",
          width: "120px",
          aspectRatio: "5 / 7",
          height: "auto",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transform: `${flipTransform} ${hoverTransform}`,
            transition: `transform 0.6s ${CARD_FLIP_EASING}`,
          }}
        >
          {/* FRONT SIDE - 連想ワード面 */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              padding: "0.75rem 0.85rem 0.75rem",
              borderRadius: "1rem",
              border: "2px solid #d4af37",
              backgroundColor: "#1a1a1a",
              color: "#ffffff",
              display: "grid",
              gridTemplateRows: "16px 1fr 16px",
              alignItems: "stretch",
              boxShadow: isHovered
                ? "0 8px 25px rgba(0,0,0,0.3)"
                : "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                lineHeight: 1,
                color: "#999",
                display: "flex",
                alignItems: "center",
              }}
            >
              #{typeof index === "number" ? index + 1 : "?"}
            </div>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  fontWeight: 700,
                  fontSize: "1.22rem",
                  textAlign: "center",
                  lineHeight: 1.15,
                  width: "100%",
                  padding: "0 0.25rem",
                  wordBreak: "keep-all",
                }}
              >
                {clue || "(連想なし)"}
              </div>
            </div>
            <div
              style={{
                fontSize: "0.65rem",
                lineHeight: 1,
                color: "#999",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                textAlign: "left",
              }}
            >
              {name ?? "(不明)"}
            </div>
          </div>

          {/* BACK SIDE - 数字面 */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              padding: "0.75rem 0.85rem 0.75rem",
              borderRadius: "1rem",
              border: `2px solid ${state === "success" ? "#22c55e" : state === "fail" ? "#dc2626" : "#d4af37"}`,
              backgroundColor: "#1a1a1a",
              boxShadow:
                state === "success"
                  ? "0 0 0 3px rgba(34, 197, 94, 0.3), 0 8px 25px rgba(0,0,0,0.3)"
                  : state === "fail"
                    ? "0 0 0 3px rgba(220,38,38,0.35), 0 8px 25px rgba(0,0,0,0.3)"
                    : isHovered
                      ? "0 8px 25px rgba(0,0,0,0.3)"
                      : "0 4px 12px rgba(0,0,0,0.15)",
              color: "white",
              display: "grid",
              gridTemplateRows: "16px 1fr 16px",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                lineHeight: 1,
                color: "rgba(255,255,255,0.75)",
                display: "flex",
                alignItems: "center",
              }}
            >
              #{typeof index === "number" ? index + 1 : "?"}
            </div>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  fontWeight: 900,
                  fontSize: "3rem",
                  color: "#d4af37",
                  lineHeight: 1,
                  textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                {typeof number === "number" ? number : "?"}
              </div>
            </div>
            <div
              style={{
                fontSize: "0.65rem",
                lineHeight: 1,
                color: "rgba(255,255,255,0.75)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                textAlign: "left",
              }}
            >
              {name ?? "(不明)"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // FLAT VARIANT - 通常のカード表示
  const hoverTransform = isHovered
    ? "translateY(-4px) scale(1.02)"
    : "translateY(0) scale(1)";

  return (
    <div
      style={{
        width: "120px",
        aspectRatio: "5 / 7",
        height: "auto",
        padding: "0.75rem 0.85rem 0.75rem",
        borderRadius: "1rem",
        border: `2px solid ${state === "success" ? "#22c55e" : state === "fail" ? "#dc2626" : "#d4af37"}`,
        backgroundColor: "#1a1a1a",
        color: "#ffffff",
        display: "grid",
        gridTemplateRows: "16px 1fr 16px",
        cursor: "pointer",
        transform: hoverTransform,
        transition: `all 0.3s ${HOVER_EASING}`,
        boxShadow:
          state === "success"
            ? "0 0 0 3px rgba(34, 197, 94, 0.3), 0 8px 25px rgba(0,0,0,0.3)"
            : state === "fail"
              ? "0 0 0 3px rgba(220,38,38,0.35), 0 8px 25px rgba(0,0,0,0.3)"
              : isHovered
                ? "0 8px 25px rgba(0,0,0,0.3)"
                : "0 4px 12px rgba(0,0,0,0.15)",
      }}
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ fontSize: "0.65rem", lineHeight: 1, color: "#999", display: "flex", alignItems: "center" }}>
        #{typeof index === "number" ? index + 1 : "?"}
      </div>
      <div style={{ position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontWeight: typeof number === "number" ? 900 : 700,
            fontSize: typeof number === "number" ? "2.6rem" : "1.22rem",
            color: typeof number === "number" ? "#d4af37" : "#ffffff",
            lineHeight: 1.05,
            textShadow:
              typeof number === "number"
                ? "0 2px 4px rgba(0,0,0,0.5)"
                : "none",
            width: "100%",
            textAlign: "center",
            padding: "0 0.25rem",
            wordBreak: "keep-all",
          }}
        >
          {typeof number === "number" ? number : clue || "?"}
        </div>
      </div>
      <div
        style={{
          fontSize: "0.65rem",
          lineHeight: 1,
          color: "#999",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          textAlign: "left",
        }}
      >
        {name ?? "(不明)"}
      </div>
    </div>
  );
}

export default GameCard;
