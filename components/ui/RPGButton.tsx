"use client";
import { AppButton } from "./AppButton";
import { rpgNavigate } from "./RPGPageTransition";
import { ComponentProps } from "react";
import { UI_TOKENS } from "@/theme/layout";

interface RPGButtonProps extends Omit<ComponentProps<typeof AppButton>, "onClick" | "as" | "href"> {
  href: string;
  onClick?: () => void;
}

export function RPGButton({ href, onClick, children, ...props }: RPGButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // カスタムonClickがある場合は先に実行
    if (onClick) {
      onClick();
    }
    
    // RPG風画面遷移を実行
    rpgNavigate(href);
  };

  return (
    <AppButton
      {...props}
      onClick={handleClick}
      style={{ 
        cursor: "pointer",
        transition: `transform 0.15s ${UI_TOKENS.EASING.standard}, box-shadow 0.15s ${UI_TOKENS.EASING.standard}, background-color 0.15s ${UI_TOKENS.EASING.standard}, color 0.15s ${UI_TOKENS.EASING.standard}, border-color 0.15s ${UI_TOKENS.EASING.standard}`
      }}
    >
      {children}
    </AppButton>
  );
}
