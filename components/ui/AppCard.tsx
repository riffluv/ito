"use client"
import { Box } from "@chakra-ui/react"

type AppCardProps = React.ComponentProps<typeof Box> & {
  interactive?: boolean
  density?: "compact" | "comfortable"
  selected?: boolean
}

export function AppCard({ interactive = false, density = "comfortable", selected = false, ...rest }: AppCardProps) {
  const baseStyles = {
    bg: "white",
    color: "gray.900",
    borderRadius: 0,
    boxShadow: "2px 2px 0 rgba(0,0,0,0.7), 4px 4px 0 rgba(0,0,0,0.5)",
    p: density === "compact" ? 5 : 6,
    transition: "background-color 0.2s ease, box-shadow 0.2s ease, transform 0.18s ease",
    ...(interactive && {
      _hover: {
        boxShadow: "3px 3px 0 rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.6)",
        bg: "gray.50",
        transform: "translateY(-1px) scale(1.01)",
      },
    }),
    ...(selected && {
      boxShadow: "4px 4px 0 rgba(59, 130, 246, 0.8), 8px 8px 0 rgba(59, 130, 246, 0.6),"
      bg: "blue.50",
    }),
  }
  
  return <Box {...baseStyles} {...rest} />
}

export default AppCard
