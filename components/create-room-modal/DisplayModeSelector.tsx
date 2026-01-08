"use client";

import React from "react";
import { HStack } from "@chakra-ui/react";

type DisplayModeValue = "full" | "minimal";

export function DisplayModeSelector({
  value,
  onChange,
}: {
  value: DisplayModeValue;
  onChange: (value: DisplayModeValue) => void;
}) {
  const getDisplayModeButtonStyle = (isSelected: boolean): React.CSSProperties => ({
    flex: 1,
    height: "52px",
    borderRadius: 0,
    fontWeight: "bold",
    fontSize: "0.95rem",
    fontFamily: "monospace",
    border: isSelected ? "3px solid white" : "2px solid rgba(255,255,255,0.5)",
    background: isSelected ? "white" : "transparent",
    color: isSelected ? "black" : "white",
    cursor: "pointer",
    textShadow: isSelected ? "none" : "1px 1px 0px #000",
    transition: "180ms cubic-bezier(.2,1,.3,1)",
    boxShadow: isSelected ? "2px 3px 0 rgba(0,0,0,.6)" : "none",
    transform: isSelected ? "translate(.5px,-.5px)" : "none",
  });

  const handleDisplayModeHover = (
    e: React.MouseEvent<HTMLButtonElement>,
    isSelected: boolean,
    isEnter: boolean
  ) => {
    if (!isSelected) {
      if (isEnter) {
        e.currentTarget.style.background = "rgba(255,255,255,0.1)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.8)";
      } else {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
      }
    }
  };

  return (
    <HStack gap={2} role="radiogroup" aria-label="カード表示モード" w="100%">
      <button
        type="button"
        onClick={() => onChange("full")}
        style={getDisplayModeButtonStyle(value === "full")}
        role="radio"
        aria-checked={value === "full"}
        tabIndex={value === "full" ? 0 : -1}
        onMouseEnter={(e) => handleDisplayModeHover(e, value === "full", true)}
        onMouseLeave={(e) => handleDisplayModeHover(e, value === "full", false)}
      >
        🤝 みんな
      </button>
      <button
        type="button"
        onClick={() => onChange("minimal")}
        style={getDisplayModeButtonStyle(value === "minimal")}
        role="radio"
        aria-checked={value === "minimal"}
        tabIndex={value === "minimal" ? 0 : -1}
        onMouseEnter={(e) => handleDisplayModeHover(e, value === "minimal", true)}
        onMouseLeave={(e) => handleDisplayModeHover(e, value === "minimal", false)}
      >
        👤 自分
      </button>
    </HStack>
  );
}

