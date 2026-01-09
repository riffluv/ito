export type StreakLevel = "normal" | "great" | "legend";

export function getStreakLevel(streak: number): StreakLevel {
  if (streak >= 10) return "legend";
  if (streak >= 5) return "great";
  return "normal";
}

export type StreakBannerConfig = {
  numberColor: string;
  labelColor: string;
  lineColor: string;
  glowColor: string;
  bgGlow: string;
  numberSize: { base: string; md: string };
  labelSize: { base: string; md: string };
  holdDuration: number;
  intensity: number;
};

export function getStreakBannerConfig(level: StreakLevel): StreakBannerConfig {
  switch (level) {
    case "legend":
      return {
        // 青白プラチナ - 神聖な輝き
        numberColor: "#E8F4FF",
        labelColor: "#B8D4FF",
        lineColor: "rgba(180, 210, 255, 0.85)",
        glowColor: "rgba(150, 200, 255, 0.6)",
        bgGlow:
          "radial-gradient(ellipse at center, rgba(100,150,255,0.25) 0%, transparent 70%)",
        numberSize: { base: "82px", md: "110px" },
        labelSize: { base: "15px", md: "18px" },
        holdDuration: 2.2,
        intensity: 1.3,
      };
    case "great":
      return {
        // 明るい黄金
        numberColor: "#FFE566",
        labelColor: "#FFD040",
        lineColor: "rgba(255, 200, 80, 0.8)",
        glowColor: "rgba(255, 180, 60, 0.5)",
        bgGlow:
          "radial-gradient(ellipse at center, rgba(255,180,60,0.2) 0%, transparent 70%)",
        numberSize: { base: "72px", md: "96px" },
        labelSize: { base: "14px", md: "17px" },
        holdDuration: 1.9,
        intensity: 1.15,
      };
    default:
      return {
        // 温かい黄金（控えめ）
        numberColor: "#FFD700",
        labelColor: "#E8C040",
        lineColor: "rgba(255, 200, 80, 0.7)",
        glowColor: "rgba(255, 180, 60, 0.35)",
        bgGlow:
          "radial-gradient(ellipse at center, rgba(255,180,60,0.12) 0%, transparent 70%)",
        numberSize: { base: "64px", md: "84px" },
        labelSize: { base: "13px", md: "16px" },
        holdDuration: 1.6,
        intensity: 1.0,
      };
  }
}

