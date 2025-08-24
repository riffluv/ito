export type GameCardState = "default" | "success" | "fail";
export type GameCardVariant = "flat" | "flip";

export function gameCardRecipe({
  state = "default",
  variant = "flat",
}: {
  state?: GameCardState;
  variant?: GameCardVariant;
}) {
  const accentBorder = state === "fail" ? "red.300" : state === "success" ? "teal.300" : "borderDefault";
  const ringShadow =
    state === "fail"
      ? "0 0 22px -4px rgba(229,62,62,0.65)"
      : state === "success"
      ? "0 0 18px -4px rgba(56,178,172,0.55)"
      : "0 6px 18px -4px rgba(0,0,0,0.35)";

  if (variant === "flip") {
    return {
      container: {
        perspective: "1000px",
        position: "relative" as const,
        width: "140px",
        height: "180px",
      },
      inner: {
        position: "absolute" as const,
        inset: 0,
        transformStyle: "preserve-3d",
        transition: "transform 0.6s",
      },
      front: {
        p: 3,
        borderRadius: "16px",
        bgGradient: "linear(135deg,#2D3748,#1A202C)",
        borderWidth: "2px",
        borderColor: accentBorder,
        boxShadow: ringShadow,
        color: "#E2E8F0",
        fontWeight: 700,
        position: "absolute" as const,
        inset: 0,
        backfaceVisibility: "hidden" as const,
        WebkitBackfaceVisibility: "hidden" as const,
      },
      back: {
        p: 3,
        borderRadius: "16px",
        bgGradient:
          state === "fail"
            ? "linear(135deg,#742A2A,#E53E3E)"
            : state === "success"
            ? "linear(135deg,#38B2AC,#2C7A7B)"
            : "linear(135deg,#2D3748,#1A202C)",
        borderWidth: "2px",
        borderColor: accentBorder,
        boxShadow:
          state === "fail"
            ? "0 0 32px -2px rgba(229,62,62,0.8)"
            : state === "success"
            ? "0 0 28px -4px rgba(56,178,172,0.8)"
            : "0 10px 35px rgba(72,187,167,0.5)",
        color: "#112025",
        fontWeight: 900,
        position: "absolute" as const,
        inset: 0,
        transform: "rotateY(180deg)",
        backfaceVisibility: "hidden" as const,
        WebkitBackfaceVisibility: "hidden" as const,
      },
    } as const;
  }

  // flat variant
  return {
    frame: {
      p: 3,
      minW: "140px",
      minH: "160px",
      borderRadius: "12px",
      bgGradient:
        state === "fail"
          ? "linear(180deg, rgba(220,50,50,0.45), rgba(0,0,0,0.15))"
          : state === "success"
          ? "linear(180deg, rgba(56,178,172,0.25), rgba(0,0,0,0.08))"
          : "linear(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      border: "1px solid rgba(255,255,255,0.04)",
      boxShadow:
        state === "fail"
          ? "0 0 0 2px rgba(255,80,80,0.7), 0 0 22px -4px rgba(255,80,80,0.6), inset 0 -6px 18px rgba(0,0,0,0.4)"
          : state === "success"
          ? "0 0 0 2px rgba(56,178,172,0.55), 0 0 18px -4px rgba(56,178,172,0.5), inset 0 -6px 18px rgba(0,0,0,0.25)"
          : "inset 0 -6px 18px rgba(0,0,0,0.2)",
    },
  } as const;
}

