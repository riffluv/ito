/**
 * LEGACY VISUAL SYSTEM (DEPRECATED / TO BE PHASED OUT)
 * 🎮 PREMIUM CARD GAME VISUAL SYSTEM (Artifact-inspired) – 旧スタイル
 * 現在は Rich Black + Orange Aesthetic への移行中のため、新規UIでは surface.* / accent.* semantic tokens
 * と recipes を優先使用。以下の資産は段階的に削除または再マッピング予定。
 *  - COSMIC_BACKGROUNDS: GameLayout immersive では未使用化済み
 *  - PREMIUM_COMPONENTS / CARD_MATERIALS などは GameCard, MiniHandDock で利用中 (TODO)
 * Refactor Plan:
 *  1. Faction-based 色計算 → semantic tokens + variant props 化
 *  2. inline gradient / boxShadow → shadow tokens / gradient tokens 再構築
 *  3. PREMIUM_TYPOGRAPHY → textStyle recipe or typography scale
 */

// 🌌 COSMIC BACKGROUND SYSTEM
export const COSMIC_BACKGROUNDS = {
  // Main game background - Artifact-style deep purple mystical space
  DEEP_SPACE: `
    radial-gradient(ellipse 120% 80% at 50% 20%, rgba(94, 39, 176, 0.6) 0%, rgba(67, 56, 202, 0.4) 30%, transparent 70%),
    radial-gradient(ellipse 100% 60% at 20% 70%, rgba(147, 51, 234, 0.5) 0%, rgba(109, 40, 217, 0.3) 40%, transparent 70%),
    radial-gradient(ellipse 80% 100% at 80% 30%, rgba(168, 85, 247, 0.4) 0%, rgba(139, 92, 246, 0.2) 50%, transparent 70%),
    radial-gradient(circle at 30% 40%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
    radial-gradient(circle at 70% 60%, rgba(139, 92, 246, 0.25) 0%, transparent 50%),
    radial-gradient(circle at 15% 85%, rgba(147, 51, 234, 0.3) 0%, transparent 40%),
    radial-gradient(circle at 85% 15%, rgba(168, 85, 247, 0.2) 0%, transparent 45%),
    linear-gradient(145deg, 
      rgba(17, 24, 39, 1) 0%,
      rgba(30, 27, 75, 0.98) 12%,
      rgba(55, 48, 163, 0.95) 28%,
      rgba(67, 56, 202, 0.92) 45%,
      rgba(76, 29, 149, 0.94) 62%,
      rgba(45, 37, 125, 0.96) 78%,
      rgba(30, 27, 75, 0.98) 88%,
      rgba(17, 24, 39, 1) 100%
    )
  `,

  // Card hover states
  CARD_AURA_GREEN: `
    radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.2) 0%, transparent 70%)
  `,
  CARD_AURA_BLUE: `
    radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.2) 0%, transparent 70%)
  `,
  CARD_AURA_RED: `
    radial-gradient(circle at 50% 50%, rgba(239, 68, 68, 0.2) 0%, transparent 70%)
  `,
  CARD_AURA_AMBER: `
    radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.2) 0%, transparent 70%)
  `,
} as const;

// 🎨 FACTION COLOR SYSTEM (Numbers 1-100)
export const FACTION_COLORS = {
  // Nature Faction (1-25) - Emerald
  EMERALD: {
    primary: "#10b981",
    secondary: "#059669",
    accent: "#34d399",
    glow: "rgba(16, 185, 129, 0.4)",
    shadow: "rgba(5, 150, 105, 0.6)",
    frame: "rgba(52, 211, 153, 0.8)",
  },

  // Knowledge Faction (26-50) - Sapphire
  SAPPHIRE: {
    primary: "#3b82f6",
    secondary: "#2563eb",
    accent: "#60a5fa",
    glow: "rgba(59, 130, 246, 0.4)",
    shadow: "rgba(37, 99, 235, 0.6)",
    frame: "rgba(96, 165, 250, 0.8)",
  },

  // Power Faction (51-75) - Ruby
  RUBY: {
    primary: "#ef4444",
    secondary: "#dc2626",
    accent: "#f87171",
    glow: "rgba(239, 68, 68, 0.4)",
    shadow: "rgba(220, 38, 38, 0.6)",
    frame: "rgba(248, 113, 113, 0.8)",
  },

  // Light Faction (76-100) - Amber
  AMBER: {
    primary: "#f59e0b",
    secondary: "#d97706",
    accent: "#fbbf24",
    glow: "rgba(245, 158, 11, 0.4)",
    shadow: "rgba(217, 119, 6, 0.6)",
    frame: "rgba(251, 191, 36, 0.8)",
  },
} as const;

// 🃏 PREMIUM CARD MATERIAL SYSTEM
export const CARD_MATERIALS = {
  // Base card with luxury finish
  PREMIUM_BASE: {
    background: `
      linear-gradient(135deg, 
        rgba(255,255,255,0.1) 0%, 
        rgba(255,255,255,0.05) 50%, 
        rgba(0,0,0,0.1) 100%
      )
    `,
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.2)",
    boxShadow: `
      0 8px 32px rgba(0,0,0,0.4),
      0 2px 8px rgba(0,0,0,0.3),
      inset 0 1px 0 rgba(255,255,255,0.1),
      inset 0 -1px 0 rgba(0,0,0,0.2)
    `,
  },

  // Hover enhancement
  PREMIUM_HOVER: {
    transform: "translateY(-8px) scale(1.05)",
    boxShadow: `
      0 20px 60px rgba(0,0,0,0.6),
      0 8px 24px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.2)
    `,
    transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  },

  // Active/selected state
  PREMIUM_ACTIVE: {
    transform: "translateY(-12px) scale(1.08)",
    filter: "brightness(1.2) contrast(1.1)",
  },
} as const;

// 🎯 PREMIUM TYPOGRAPHY
export const PREMIUM_TYPOGRAPHY = {
  GAME_TITLE: {
    fontFamily: '"Cinzel", "Times New Roman", serif',
    fontWeight: 700,
    letterSpacing: "0.05em",
    textShadow: "0 2px 8px rgba(0,0,0,0.8)",
  },

  CARD_NUMBER: {
    fontFamily: '"Orbitron", "Courier New", monospace',
    fontWeight: 800,
    letterSpacing: "0.02em",
    textShadow: "0 1px 4px rgba(0,0,0,0.6)",
  },

  MYSTICAL_TEXT: {
    fontFamily: '"Cinzel Decorative", serif',
    fontWeight: 600,
    letterSpacing: "0.03em",
    textShadow: "0 1px 6px rgba(255,255,255,0.3)",
  },
} as const;

// ✨ PARTICLE & ANIMATION EFFECTS
export const PREMIUM_EFFECTS = {
  // Floating particles animation
  FLOATING_PARTICLES: `
    @keyframes floatParticles {
      0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.7; }
      50% { transform: translateY(-20px) rotate(180deg); opacity: 1; }
    }
  `,

  // Card reveal animation
  CARD_REVEAL: `
    @keyframes cardReveal {
      0% { 
        transform: rotateY(90deg) scale(0.8); 
        opacity: 0; 
      }
      50% {
        transform: rotateY(45deg) scale(0.9);
        opacity: 0.7;
      }
      100% { 
        transform: rotateY(0deg) scale(1); 
        opacity: 1; 
      }
    }
  `,

  // Mystical glow pulse
  MYSTICAL_GLOW: `
    @keyframes mysticalGlow {
      0%, 100% { filter: drop-shadow(0 0 8px currentColor); }
      50% { filter: drop-shadow(0 0 20px currentColor); }
    }
  `,
} as const;

// 🎮 NUMBER TO FACTION MAPPER
export function getNumberFaction(num: number): keyof typeof FACTION_COLORS {
  if (num <= 25) return "EMERALD";
  if (num <= 50) return "SAPPHIRE";
  if (num <= 75) return "RUBY";
  return "AMBER";
}

// 🎨 FACTION STYLE GENERATOR
export function getFactionStyles(num: number) {
  const faction = getNumberFaction(num);
  const colors = FACTION_COLORS[faction];

  return {
    primary: colors.primary,
    secondary: colors.secondary,
    accent: colors.accent,
    glow: colors.glow,
    shadow: colors.shadow,
    frame: colors.frame,
    aura:
      faction === "EMERALD"
        ? COSMIC_BACKGROUNDS.CARD_AURA_GREEN
        : faction === "SAPPHIRE"
          ? COSMIC_BACKGROUNDS.CARD_AURA_BLUE
          : faction === "RUBY"
            ? COSMIC_BACKGROUNDS.CARD_AURA_RED
            : COSMIC_BACKGROUNDS.CARD_AURA_AMBER,
  };
}

// 🌟 PREMIUM UI COMPONENTS STYLES - Artifact Inspired
export const PREMIUM_COMPONENTS = {
  // Artifact-style mystical panel frame
  MYSTICAL_PANEL: {
    background: `
      linear-gradient(135deg, 
        rgba(139, 92, 246, 0.12) 0%,
        rgba(168, 85, 247, 0.08) 25%,
        rgba(147, 51, 234, 0.1) 50%,
        rgba(109, 40, 217, 0.08) 75%,
        rgba(94, 39, 176, 0.12) 100%
      )
    `,
    border: "1px solid rgba(168, 85, 247, 0.4)",
    borderRadius: "12px",
    boxShadow: `
      0 8px 32px rgba(94, 39, 176, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(168, 85, 247, 0.2),
      inset 0 -1px 0 rgba(67, 56, 202, 0.3)
    `,
    backdropFilter: "blur(16px) saturate(1.2)",
  },

  // Artifact-style premium button
  ARTIFACT_BUTTON: {
    background: `
      linear-gradient(135deg, 
        rgba(168, 85, 247, 0.2) 0%,
        rgba(139, 92, 246, 0.15) 25%,
        rgba(147, 51, 234, 0.18) 50%,
        rgba(109, 40, 217, 0.15) 75%,
        rgba(94, 39, 176, 0.2) 100%
      )
    `,
    border: "1px solid rgba(168, 85, 247, 0.6)",
    borderRadius: "8px",
    boxShadow: `
      0 4px 16px rgba(94, 39, 176, 0.4),
      0 2px 8px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(168, 85, 247, 0.3)
    `,
    backdropFilter: "blur(12px)",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  },

  // Mystical card frame (hand-crafted feel)
  MYSTICAL_CARD: {
    background: `
      linear-gradient(145deg, 
        rgba(168, 85, 247, 0.15) 0%,
        rgba(139, 92, 246, 0.1) 30%,
        rgba(147, 51, 234, 0.12) 60%,
        rgba(109, 40, 217, 0.08) 100%
      )
    `,
    border: "2px solid rgba(168, 85, 247, 0.5)",
    borderRadius: "16px",
    boxShadow: `
      0 12px 40px rgba(94, 39, 176, 0.4),
      0 6px 20px rgba(0, 0, 0, 0.4),
      inset 0 2px 0 rgba(168, 85, 247, 0.2),
      inset 0 -2px 0 rgba(67, 56, 202, 0.3)
    `,
    backdropFilter: "blur(20px) saturate(1.3)",
  },
} as const;
