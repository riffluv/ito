import { defineRecipe } from "@chakra-ui/react"

export const buttonRecipe = defineRecipe({
  className: "app-btn",
  base: {
    // 🎯 CHAKRA OFFICIAL QUALITY TYPOGRAPHY
    fontWeight: "600",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    letterSpacing: "-0.01em",
    lineHeight: 1.2,
    textTransform: "none",
    
    // 🎯 PROFESSIONAL INTERACTION DESIGN
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    userSelect: "none",
    
    // 🎯 SOPHISTICATED ANIMATION SYSTEM
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    willChange: "transform, box-shadow, background",
    
    // 🎯 ACCESSIBILITY & INTERACTION STATES
    _focusVisible: {
      outline: "2px solid",
      outlineColor: "rgba(99,102,241,0.6)",
      outlineOffset: "2px",
      boxShadow: "0 0 0 4px rgba(99,102,241,0.15)"
    },
    _disabled: {
      opacity: 0.4,
      cursor: "not-allowed",
      transform: "none !important",
      boxShadow: "none !important"
    },
    
    // 🎯 PREMIUM MICRO-INTERACTIONS
    _active: {
      transform: "translateY(1px) scale(0.98)"
    }
  },
  variants: {
    size: {
      // 🎯 CHAKRA OFFICIAL SIZE SYSTEM - Perfect scaling ratios
      xs: { 
        px: 3, 
        py: 1.5, 
        fontSize: "0.75rem", 
        minW: "auto", 
        height: "2rem",
        gap: 1.5,
        borderRadius: "8px"
      },
      sm: { 
        px: 4, 
        py: 2, 
        fontSize: "0.875rem", 
        minW: "auto", 
        height: "2.25rem",
        gap: 2,
        borderRadius: "10px"
      },
      md: { 
        px: 5, 
        py: 2.5, 
        fontSize: "0.875rem", 
        minW: "auto", 
        height: "2.75rem",
        gap: 2,
        borderRadius: "12px"
      },
      lg: { 
        px: 6, 
        py: 3, 
        fontSize: "1rem", 
        minW: "auto", 
        height: "3.25rem",
        gap: 2.5,
        borderRadius: "14px"
      },
      xl: {
        px: 8, 
        py: 4, 
        fontSize: "1.125rem", 
        minW: "auto", 
        height: "3.75rem",
        gap: 3,
        borderRadius: "16px"
      }
    },
    density: {
      compact: { 
        py: 2,
        gap: 1.5
      },
      comfortable: { 
        py: 3,
        gap: 2.5
      },
    },
    visual: {
      // 🎯 SOLID - Premium gradient system like Chakra official
      solid: { 
        background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
        color: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.15)",
        border: "1px solid rgba(255,255,255,0.1)",
        
        _hover: {
          background: "linear-gradient(135deg, #5B5FE8 0%, #7C3AED 100%)",
          transform: "translateY(-2px)",
          boxShadow: "0 8px 25px -5px rgba(99,102,241,0.4), 0 4px 12px -2px rgba(139,92,246,0.25), inset 0 1px 0 rgba(255,255,255,0.2)",
          borderColor: "rgba(255,255,255,0.2)"
        },
        _active: {
          transform: "translateY(0) scale(0.98)",
          boxShadow: "0 3px 8px rgba(99,102,241,0.3), inset 0 2px 4px rgba(0,0,0,0.1)"
        }
      },

      // 🎯 OUTLINE - Sophisticated border system
      outline: { 
        background: "rgba(255,255,255,0.01)",
        color: "rgba(255,255,255,0.9)",
        border: "1.5px solid rgba(255,255,255,0.15)",
        backdropFilter: "blur(8px)",
        
        _hover: {
          background: "rgba(255,255,255,0.08)",
          borderColor: "rgba(99,102,241,0.5)",
          color: "white",
          transform: "translateY(-1px)",
          boxShadow: "0 4px 16px -4px rgba(99,102,241,0.2)"
        },
        _active: {
          transform: "translateY(0) scale(0.98)",
          background: "rgba(255,255,255,0.04)"
        }
      },

      // 🎯 GHOST - Ultra-subtle professional variant
      ghost: { 
        background: "transparent",
        color: "rgba(255,255,255,0.7)",
        border: "1px solid transparent",
        
        _hover: {
          color: "rgba(255,255,255,0.95)",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          transform: "translateY(-1px)",
          backdropFilter: "blur(8px)"
        },
        _active: {
          transform: "translateY(0) scale(0.98)",
          background: "rgba(255,255,255,0.03)"
        }
      },

      // 🎯 SUBTLE - Accent color system (no more orange!)
      subtle: {
        background: "rgba(99,102,241,0.15)",
        color: "#B4B8FF",
        border: "1px solid rgba(99,102,241,0.25)",
        backdropFilter: "blur(4px)",
        
        _hover: {
          background: "rgba(99,102,241,0.25)",
          color: "#C7CBFF",
          borderColor: "rgba(99,102,241,0.4)",
          transform: "translateY(-1px)",
          boxShadow: "0 4px 16px -4px rgba(99,102,241,0.3)"
        },
        _active: {
          transform: "translateY(0) scale(0.98)",
          background: "rgba(99,102,241,0.2)"
        }
      },

      // 🎯 SURFACE - Premium glass morphism effect
      surface: {
        background: "rgba(25,27,33,0.6)",
        color: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 4px 12px -2px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
        
        _hover: {
          background: "rgba(31,35,44,0.8)",
          borderColor: "rgba(255,255,255,0.2)",
          transform: "translateY(-1px)",
          boxShadow: "0 8px 24px -4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)"
        },
        _active: {
          transform: "translateY(0) scale(0.98)",
          background: "rgba(22,24,30,0.7)"
        }
      },

      // 🎯 PLAIN - Minimal interaction button
      plain: {
        color: "rgba(255,255,255,0.8)",
        background: "transparent",
        border: "none",
        px: 3,
        py: 2,
        minW: "auto",
        borderRadius: "8px",
        
        _hover: {
          color: "rgba(255,255,255,0.95)",
          background: "rgba(255,255,255,0.05)"
        },
        _active: {
          background: "rgba(255,255,255,0.08)"
        }
      }
    },
    palette: {
      // 🎯 BRAND - Premium indigo/violet identity
      brand: { 
        _focusVisible: { 
          outlineColor: "rgba(99,102,241,0.6)",
          boxShadow: "0 0 0 4px rgba(99,102,241,0.15)"
        },
        "&[data-visual=solid]": {
          background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
          boxShadow: "0 4px 16px -4px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
          _hover: {
            background: "linear-gradient(135deg, #5B5FE8 0%, #7C3AED 100%)",
            boxShadow: "0 8px 25px -5px rgba(99,102,241,0.5)"
          }
        },
        "&[data-visual=subtle]": {
          background: "rgba(99,102,241,0.12)",
          color: "#C7CBFF",
          border: "1px solid rgba(99,102,241,0.25)"
        }
      },

      // 🎯 GRAY - Sophisticated neutral system
      gray: { 
        _focusVisible: { 
          outlineColor: "rgba(156,163,175,0.6)",
          boxShadow: "0 0 0 4px rgba(156,163,175,0.15)"
        },
        "&[data-visual=solid]": {
          background: "linear-gradient(135deg, rgba(55,65,81,0.9) 0%, rgba(75,85,99,0.9) 100%)",
          color: "rgba(255,255,255,0.95)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 4px 12px -2px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
          _hover: {
            background: "linear-gradient(135deg, rgba(75,85,99,0.9) 0%, rgba(107,114,128,0.9) 100%)",
            boxShadow: "0 8px 20px -4px rgba(0,0,0,0.3)"
          }
        },
        "&[data-visual=outline]": {
          borderColor: "rgba(156,163,175,0.3)",
          color: "rgba(156,163,175,0.9)",
          _hover: {
            borderColor: "rgba(156,163,175,0.5)",
            color: "rgba(209,213,219,0.95)"
          }
        }
      },

      // 🎯 DANGER - Professional red system
      danger: {
        _focusVisible: { 
          outlineColor: "rgba(239,68,68,0.6)",
          boxShadow: "0 0 0 4px rgba(239,68,68,0.15)"
        },
        "&[data-visual=solid]": {
          background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
          color: "white",
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: "0 4px 16px -4px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
          _hover: {
            background: "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)",
            boxShadow: "0 8px 25px -5px rgba(239,68,68,0.5)"
          }
        },
        "&[data-visual=subtle]": {
          background: "rgba(239,68,68,0.12)",
          color: "#FECACA",
          border: "1px solid rgba(239,68,68,0.25)"
        }
      },

      // 🎯 SUCCESS - Premium green system
      success: {
        _focusVisible: { 
          outlineColor: "rgba(34,197,94,0.6)",
          boxShadow: "0 0 0 4px rgba(34,197,94,0.15)"
        },
        "&[data-visual=solid]": {
          background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
          color: "white",
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: "0 4px 16px -4px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
          _hover: {
            background: "linear-gradient(135deg, #16A34A 0%, #15803D 100%)",
            boxShadow: "0 8px 25px -5px rgba(34,197,94,0.5)"
          }
        },
        "&[data-visual=subtle]": {
          background: "rgba(34,197,94,0.12)",
          color: "#BBF7D0",
          border: "1px solid rgba(34,197,94,0.25)"
        }
      }
    },
  },
  defaultVariants: { 
    size: "md", 
    density: "comfortable", 
    visual: "solid", 
    palette: "brand" 
  },
})

export default buttonRecipe
