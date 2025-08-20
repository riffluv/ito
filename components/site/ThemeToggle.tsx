"use client";
import { IconButton, Tooltip } from "@chakra-ui/react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

/**
 * ThemeToggle
 * - SSR/CSR のハイドレーション不一致を避けるため初回レンダリングでは
 *   サーバー側と同じ固定アイコンを返します（マウント後に切替え）。
 * - アクセシビリティのために `aria-label` を動的に更新します。
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // マウント後に真となるフラグ。これによりサーバ側の HTML と一致させる。
  useEffect(() => {
    setMounted(true);
  }, []);

  // テーマ判定はマウント後のみ厳密に行う
  const isDark = mounted ? resolvedTheme === "dark" : false;

  const handleToggle = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);

  const label = isDark ? "ライトモードに切替" : "ダークモードに切替";

  // 初回は Sun を描画してサーバーHTMLと一致させる。マウント後は実際の状態に応じたアイコンを描画。
  const icon = mounted && !isDark ? <Moon size={18} /> : <Sun size={18} />;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <IconButton
          aria-label={label}
          title={label}
          onClick={handleToggle}
          variant="ghost"
        >
          {icon}
        </IconButton>
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip.Root>
  );
}
