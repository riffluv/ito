"use client"
import { chakra, useRecipe, Box as CBox } from "@chakra-ui/react"
import { cardRecipe } from "../../theme/recipes/card.recipe"

type AppCardProps = React.ComponentProps<typeof CBox> & {
  interactive?: boolean
  density?: "compact" | "comfortable"
  selected?: boolean
}

export function AppCard({ interactive = false, density = "comfortable", selected = false, ...rest }: AppCardProps) {
  const recipe = useRecipe({ recipe: cardRecipe })
  const styles = recipe({
    interactive,
    density,
    selected,
  })
  return <CBox {...(styles as any)} {...rest} />
}

export default AppCard
