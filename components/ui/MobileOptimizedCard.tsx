"use client";
import { Box, Text, useBreakpointValue } from "@chakra-ui/react";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { forwardRef, ReactNode } from "react";

interface MobileOptimizedCardProps {
  children?: ReactNode;
  isSelected?: boolean;
  isPlaced?: boolean;
  isFailed?: boolean;
  isDragging?: boolean;
  number?: number | null;
  name?: string;
  backgroundColor?: string;
  onClick?: () => void;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export const MobileOptimizedCard = forwardRef<HTMLDivElement, MobileOptimizedCardProps>(
  ({
    children,
    isSelected = false,
    isPlaced = false,
    isFailed = false,
    isDragging = false,
    number,
    name,
    backgroundColor,
    onClick,
    onTouchStart,
    onTouchEnd,
    style,
    className,
    ...props
  }, ref) => {
    // Responsive sizing
    const cardSize = useBreakpointValue({
      base: {
        width: "60px",
        height: "80px",
        fontSize: "10px",
        padding: "0.5rem",
      },
      sm: {
        width: UNIFIED_LAYOUT.CARD.WIDTH,
        height: UNIFIED_LAYOUT.CARD.HEIGHT,
        fontSize: "12px", 
        padding: "0.75rem",
      },
      md: {
        width: UNIFIED_LAYOUT.CARD.WIDTH,
        height: UNIFIED_LAYOUT.CARD.HEIGHT,
        fontSize: "14px",
        padding: "1rem",
      },
    });

    // Touch feedback optimization
    const touchStyles = {
      WebkitTapHighlightColor: "transparent",
      WebkitTouchCallout: "none",
      WebkitUserSelect: "none",
      userSelect: "none" as const,
    };

    // Dynamic styles based on state
    const dynamicStyles = {
      transform: isDragging ? "scale(1.05) rotate(2deg)" : isSelected ? "scale(1.02)" : "scale(1)",
      transition: isDragging ? "transform 0.1s ease-out" : "transform 0.2s ease, box-shadow 0.2s ease",
      boxShadow: isDragging 
        ? "0 8px 25px rgba(0, 0, 0, 0.3)" 
        : isSelected 
        ? "0 4px 12px rgba(59, 130, 246, 0.4)"
        : "0 2px 8px rgba(0, 0, 0, 0.1)",
      cursor: onClick ? "pointer" : "default",
      zIndex: isDragging ? 1000 : isSelected ? 10 : 1,
    };

    // Border and background logic
    const borderColor = isFailed 
      ? "#ef4444" 
      : isSelected 
      ? "#3b82f6" 
      : isPlaced 
      ? "#10b981" 
      : "#e2e8f0";

    const bgColor = backgroundColor || (isPlaced ? "#f0fdf4" : "#ffffff");

    return (
      <Box
        ref={ref}
        className={className}
        role="button"
        tabIndex={onClick ? 0 : undefined}
        aria-label={name ? `Player ${name}${number ? `, number ${number}` : ''}` : undefined}
        width={cardSize?.width}
        height={cardSize?.height}
        bg={bgColor}
        border="2px solid"
        borderColor={borderColor}
        borderRadius="xl"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        position="relative"
        overflow="hidden"
        p={cardSize?.padding}
        fontSize={cardSize?.fontSize}
        fontWeight="600"
        style={{
          ...touchStyles,
          ...dynamicStyles,
          ...style,
        }}
        onClick={onClick}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        // Accessibility improvements
        _focus={{
          outline: "2px solid #3b82f6",
          outlineOffset: "2px",
        }}
        _active={{
          transform: "scale(0.98)",
        }}
        {...props}
      >
        {/* Touch feedback overlay */}
        {(isSelected || isDragging) && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg={isDragging ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.05)"}
            borderRadius="xl"
            pointerEvents="none"
          />
        )}

        {/* Number indicator */}
        {typeof number === 'number' && (
          <Box
            position="absolute"
            top="0.25rem"
            right="0.25rem"
            bg="rgba(0, 0, 0, 0.7)"
            color="white"
            borderRadius="full"
            width="1.5rem"
            height="1.5rem"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="10px"
            fontWeight="bold"
          >
            {number}
          </Box>
        )}

        {/* Name display */}
        {name && (
          <Text
            textAlign="center"
            fontWeight="600"
            color={isFailed ? "red.600" : "gray.800"}
            lineHeight={1.2}
            noOfLines={2}
            wordBreak="break-word"
            w="100%"
          >
            {name}
          </Text>
        )}

        {/* Custom children content */}
        {children}

        {/* Status indicators */}
        {isPlaced && !isFailed && (
          <Box
            position="absolute"
            bottom="0.25rem"
            right="0.25rem"
            color="green.500"
            fontSize="12px"
          >
            ✓
          </Box>
        )}

        {isFailed && (
          <Box
            position="absolute"
            bottom="0.25rem"
            right="0.25rem"
            color="red.500"
            fontSize="12px"
          >
            ✗
          </Box>
        )}

        {/* Long press hint for mobile D&D */}
        {useBreakpointValue({ base: true, md: false }) && onClick && (
          <Box
            position="absolute"
            bottom="0.25rem"
            left="0.25rem"
            opacity={0.6}
            fontSize="8px"
            color="gray.500"
          >
            👆
          </Box>
        )}
      </Box>
    );
  }
);

MobileOptimizedCard.displayName = "MobileOptimizedCard";