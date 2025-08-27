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
    rounded: "lg",
    shadow: "xs",
    p: density === "compact" ? 5 : 6,
    transition: "background-color 0.2s ease, box-shadow 0.2s ease, transform 0.18s ease",
    ...(interactive && {
      _hover: {
        shadow: "sm",
        bg: "gray.50",
        transform: "translateY(-1px) scale(1.01)",
      },
    }),
    ...(selected && {
      shadow: "md",
      bg: "blue.50",
    }),
  }
  
  return <Box {...baseStyles} {...rest} />
}

export default AppCard
