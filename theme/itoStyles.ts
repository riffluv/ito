// Centralized style objects for inline-heavy components (pre-UI redesign)
// Each style is a plain object so it can be spread into Chakra's `css` prop.

export const handDockStyles = {
  numberBox: {
    background: "#0f172a",
    color: "#fff",
    boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
  },
  clueInput: {
    background: "rgba(101,67,33,0.8)",
    border: "1px solid rgba(160,133,91,0.6)",
    color: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(10px)",
  },
  startButton: {
    background: "linear-gradient(137deg, #10b981, #059669)", // AI感除去: 135deg → 137deg
    color: "#fff",
    fontWeight: "700",
    px: "24px",
    py: "12px",
    boxShadow: "0 8px 20px rgba(16, 185, 129, 0.4)",
    _hover: {
      transform: "translateY(-2px)",
      boxShadow: "0 12px 28px rgba(16, 185, 129, 0.5)",
    },
    transition: "all 0.2s ease",
  },
  evaluateEnabled: {
    background: "linear-gradient(137deg, #f59e0b, #d97706)", // AI感除去: 135deg → 137deg
    boxShadow: "0 8px 20px rgba(245, 158, 11, 0.4)",
  },
  evaluateDisabled: {
    background: "linear-gradient(137deg, #6b7280, #4b5563)", // AI感除去: 135deg → 137deg
    boxShadow: "0 4px 12px rgba(107, 114, 128, 0.3)",
  },
  evaluateShared: {
    color: "#fff",
    fontWeight: "700",
    px: "24px",
    py: "12px",
    transition: "all 0.2s ease",
    _hover: {
      transform: "translateY(-2px)",
      boxShadow: "0 12px 28px rgba(245, 158, 11, 0.5)",
    },
  },
  retryButton: {
    background: "linear-gradient(137deg, #3b82f6, #2563eb)", // AI感除去: 135deg → 137deg
    color: "#fff",
    fontWeight: "700",
    px: "24px",
    py: "12px",
    boxShadow: "0 8px 20px rgba(59, 130, 246, 0.4)",
    _hover: {
      transform: "translateY(-2px)",
      boxShadow: "0 12px 28px rgba(59, 130, 246, 0.5)",
    },
    transition: "all 0.2s ease",
  },
  hostDivider: {
    borderLeft: "2px solid rgba(107, 114, 128, 0.3)",
    paddingLeft: "12px",
    marginLeft: "8px",
  },
  modeBadge: (isSort: boolean) => ({
    background: isSort ? "rgba(16, 185, 129, 0.4)" : "rgba(101,67,33,0.4)",
    color: "rgba(255,255,255,0.9)",
    border: `1px solid ${isSort ? "rgba(16, 185, 129, 0.5)" : "rgba(160,133,91,0.3)"}`,
    whiteSpace: "nowrap",
  }),
  tinyOutlineNeutral: {
    fontSize: "xs",
    px: "10px",
    py: "6px",
    border: "1.5px solid rgba(107, 114, 128, 0.4)",
    color: "rgba(107, 114, 128, 0.9)",
    _hover: {
      borderColor: "rgba(107, 114, 128, 0.6)",
      background: "rgba(107, 114, 128, 0.1)",
    },
  },
  tinyOutlineDanger: {
    fontSize: "xs",
    px: "10px",
    py: "6px",
    border: "1.5px solid rgba(239, 68, 68, 0.4)",
    color: "rgba(239, 68, 68, 0.9)",
    _hover: {
      borderColor: "rgba(239, 68, 68, 0.6)",
      background: "rgba(239, 68, 68, 0.1)",
    },
  },
};
