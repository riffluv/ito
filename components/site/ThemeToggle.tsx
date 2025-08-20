"use client";
import { IconButton } from "@chakra-ui/react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Hydration mismatch防止: 初回はアイコン切替を行わない
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted ? resolvedTheme === "dark" : false;

  return (
    <IconButton
      aria-label="カラーモード切替"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      variant="ghost"
    >
      {/* 初回は固定のアイコン（Sun）を描画してサーバーと一致させる */}
      {mounted ? (isDark ? <Sun size={18} /> : <Moon size={18} />) : <Sun size={18} />}
    </IconButton>
  );
}
