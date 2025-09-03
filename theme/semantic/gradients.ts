export const semanticGradients = {
  // === Core UI gradients (Chakra-inspired) ===
  primaryBrand: {
    value: "linear-gradient(135deg, #6B73FF 0%, #9945FF 100%)",
  },
  primaryBrandSubtle: {
    value:
      "linear-gradient(135deg, rgba(107,115,255,0.1) 0%, rgba(153,69,255,0.05) 100%)",
  },
  accentWarm: {
    value: "linear-gradient(135deg, #F7931E 0%, #FF6B35 100%)",
  },
  heroBackground: {
    value:
      "radial-gradient(ellipse 150% 100% at 50% 0%, rgba(107,115,255,0.15) 0%, rgba(153,69,255,0.08) 25%, transparent 60%)",
  },
  heroOverlay: {
    value:
      "linear-gradient(135deg, rgba(107,115,255,0.05) 0%, transparent 50%, rgba(247,147,30,0.03) 100%)",
  },

  // === Legacy gradients (preserved for compatibility) ===
  accentSoft: { value: "{gradients.accentSoft}" },
  dangerStrong: { value: "{gradients.dangerStrong}" },
  playerNumber: { value: "{gradients.playerNumber}" },
  boardPattern: {
    value:
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 8px, transparent 8px, transparent 16px)",
  },
  cardPurple: {
    value:
      "linear(135deg, rgba(30,15,50,0.95), rgba(50,25,80,0.95) 30%, rgba(70,35,110,0.95) 70%, rgba(30,15,50,0.95))",
  },
  cardSuccess: {
    value: "linear(135deg, rgba(20,60,30,0.9), rgba(20,35,20,0.9))",
  },
  cardFail: {
    value: "linear(135deg, rgba(60,20,20,0.9), rgba(35,10,10,0.95))",
  },
  panelWood: {
    value: "linear(180deg, rgba(101,67,33,0.8) 0%, rgba(80,53,26,0.9) 100%)",
  },
};
