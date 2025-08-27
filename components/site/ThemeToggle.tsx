"use client";
import { IconButton, VisuallyHidden } from "@chakra-ui/react";
import { Sun } from "lucide-react";

/**
 * ThemeToggle - ライトモード固定版
 * ダークモード機能を完全除去し、ライトモード1本に集中
 */
export default function ThemeToggle() {
  // ライトモード固定 - 機能的に無効化
  const label = "ライトモード（固定）";
  const icon = <Sun size={18} />;

  const handleClick = () => {
    // 何もしない - ライトモード固定のため
  };

  return (
    <>
      <IconButton
        aria-label={label}
        title={label}
        onClick={handleClick}
        variant="ghost"
        rounded="full"
        disabled // ライトモード固定のため無効化
        opacity={0.6} // 視覚的に無効化されていることを表示
        cursor="default"
        _focusVisible={{
          outline: "2px solid",
          outlineColor: "focusRing",
          outlineOffset: "2px",
        }}
      >
        {icon}
      </IconButton>
      {/* aria-live for SRs without visual noise */}
      <VisuallyHidden aria-live="polite">{label}</VisuallyHidden>
    </>
  );
}
