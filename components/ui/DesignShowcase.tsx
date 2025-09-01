"use client";
import type { buttonRecipe } from "@/theme/recipes/button.recipe";
import {
  Box,
  Stack,
  Text,
  useRecipe,
  useSlotRecipe,
  type RecipeVariantProps,
} from "@chakra-ui/react";

// Showcase: Button & Card (recipes) + Toast trigger placeholder
// 目的: エージェント/開発者が tokens & variants の標準利用形を参照できる最小例

export function DesignShowcase() {
  // 型補完を安定させるために RecipeVariantProps を利用
  const button = useRecipe({ key: "button" });
  type ButtonVariants = RecipeVariantProps<typeof buttonRecipe>;
  const card = useRecipe({ key: "card" });
  // gameCard slot recipe (state/variant例) 利用を表示
  const gameCard = useSlotRecipe({ key: "gameCard" });

  const solidMd = button({ visual: "solid", size: "md" } as ButtonVariants);
  const subtleSm = button({ visual: "subtle", size: "sm" } as ButtonVariants);
  const ghostLg = button({ visual: "ghost", size: "lg" } as ButtonVariants);

  const baseCard = card({ interactive: true, density: "comfortable" });

  const flipDefault = gameCard({ variant: "flip", state: "default" });
  const flipSuccess = gameCard({ variant: "flip", state: "success" });
  const flatFail = gameCard({ variant: "flat", state: "fail" });

  return (
    <Stack gap={8} p={6} maxW="960px">
      <Box>
        <Text fontWeight="bold" mb={3} fontSize="lg">
          Buttons (recipe)
        </Text>
        <Stack direction="row" gap={4} align="flex-start" flexWrap="wrap">
          <Box as="button" css={solidMd}>
            Solid md
          </Box>
          <Box as="button" css={subtleSm}>
            Subtle sm
          </Box>
          <Box as="button" css={ghostLg}>
            Ghost lg
          </Box>
        </Stack>
      </Box>

      <Box>
        <Text fontWeight="bold" mb={3} fontSize="lg">
          Card (recipe)
        </Text>
        <Stack direction="row" gap={6} flexWrap="wrap">
          <Box css={baseCard} minW="220px">
            Interactive Card
          </Box>
        </Stack>
      </Box>

      <Box>
        <Text fontWeight="bold" mb={3} fontSize="lg">
          GameCard (slot recipe)
        </Text>
        <Stack direction="row" gap={6} flexWrap="wrap">
          <Box position="relative" css={flipDefault.container}>
            <Box css={flipDefault.frame}>Default</Box>
          </Box>
          <Box position="relative" css={flipSuccess.container}>
            <Box css={flipSuccess.frame}>Success</Box>
          </Box>
          <Box position="relative" css={flatFail.container}>
            <Box css={flatFail.frame}>Fail (Flat)</Box>
          </Box>
        </Stack>
      </Box>

      <Box>
        <Text fontWeight="bold" mb={3} fontSize="lg">
          Tokens quick check
        </Text>
        <Stack direction="row" gap={4}>
          <Box
            bg="accentSubtle"
            color="accent"
            px={4}
            py={2}
            rounded="md"
            borderWidth="thin"
          >
            accentSubtle
          </Box>
          <Box bg="successSubtle" px={4} py={2} rounded="md" borderWidth="thin">
            successSubtle
          </Box>
          <Box bg="dangerSubtle" px={4} py={2} rounded="md" borderWidth="thin">
            dangerSubtle
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
}
