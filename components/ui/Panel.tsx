"use client";
import { Box, Heading, chakra, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

// theme/index.ts の panel slot recipe から型を抽出
type PanelVariants = {
  density?: "comfortable" | "compact";
  variant?: "surface" | "subtle" | "outlined" | "accent";
  elevated?: boolean;
};

export interface PanelProps
  extends Omit<React.ComponentProps<typeof Box>, "title">,
    PanelVariants {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Panel(props: PanelProps) {
  const {
    title,
    actions,
    children,
    density = "comfortable",
    variant = "surface",
    elevated = false,
    className,
    css: customCss,
    ...rest
  } = props;
  
  const panelRecipe = useSlotRecipe({ key: "panel" });
  const styles = panelRecipe({ density, variant, elevated });

  // classNameを結合してカスタマイズ可能に
  const combinedClassName = `panel ${className ?? ''}`.trim();

  // 🎮 PREMIUM PANEL ENHANCEMENT
  const premiumStyles = customCss || {};

  return (
    <Box 
      css={{
        // Base recipe styles
        ...styles.container,
        // Premium enhancements
        transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        // Custom styles override
        ...premiumStyles,
      }} 
      className={combinedClassName} 
      {...rest}
    >
      {(title || actions) && (
        <Box css={{
          ...styles.header,
          // 🎮 PREMIUM HEADER STYLING
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
          backdropFilter: "blur(5px)",
        }}>
          {title ? (
            <Heading as={chakra.h3} css={{
              ...styles.title,
              // 🎮 PREMIUM TITLE STYLING
              color: "#ffd700",
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
              fontWeight: 700,
            }}>
              {title}
            </Heading>
          ) : (
            <Box /> 
          )}
          {actions && <Box css={styles.actions}>{actions}</Box>}
        </Box>
      )}
      <Box css={{
        ...styles.body,
        // 🎮 PREMIUM BODY STYLING
        color: "rgba(255,255,255,0.9)",
      }}>
        {children}
      </Box>
    </Box>
  );
}