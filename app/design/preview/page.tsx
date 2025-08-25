import { DevPresetSwitcher } from "@/components/DevPresetSwitcher";
import GameCard from "@/components/ui/GameCard";
import { Panel } from "@/components/ui/Panel";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Grid, Heading, HStack, Stack, Text } from "@chakra-ui/react";

export const metadata = { title: "Design Preview" };

export default function DesignPreviewPage() {
  return (
    <Box p={6} maxW="7xl" mx="auto">
      <HStack justify="space-between" mb={6}>
        <Heading size="lg">Design System Preview</Heading>
        <DevPresetSwitcher />
      </HStack>
      <Grid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
        <Panel title="Panel Variants" density="comfortable">
          <Stack gap={4}>
            <Panel title="Subtle" variant="subtle" density="compact">
              <Text fontSize="sm">Subtle variant body</Text>
            </Panel>
            <Panel title="Surface" variant="surface" density="compact">
              <Text fontSize="sm">Surface variant body</Text>
            </Panel>
            <Panel title="Outlined" variant="outlined" density="compact">
              <Text fontSize="sm">Outlined variant body</Text>
            </Panel>
            <Panel title="Accent" variant="accent" density="compact">
              <Text fontSize="sm">Accent variant body</Text>
            </Panel>
          </Stack>
        </Panel>
        <Panel title="GameCard States" density="comfortable">
          <HStack wrap="wrap" gap={4}>
            <GameCard number={17} state="default" />
            <GameCard number={42} state="success" />
            <GameCard number={3} state="fail" />
            <GameCard number={88} state="default" variant="flip" flipped />
          </HStack>
        </Panel>
        <Panel title="Tokens Sample" density="comfortable">
          <Stack gap={3} fontSize="sm">
            <TokenRow name="focusRing" tokenVar="--colors-focusRing" />
            <TokenRow name="panelBg" tokenVar="--colors-panelBg" />
            <TokenRow name="canvasBg" tokenVar="--colors-canvasBg" />
          </Stack>
        </Panel>
      </Grid>
    </Box>
  );
}

function TokenRow({ name, tokenVar }: { name: string; tokenVar: string }) {
  return (
    <HStack>
      <Box w={28}>{name}</Box>
      <Box
        flex={1}
        h={6}
        rounded="md"
        borderWidth={UNIFIED_LAYOUT.BORDER_WIDTH}
        bg={`var(${tokenVar})`}
      />
      <Text fontFamily="mono" fontSize="xs">
        {tokenVar}
      </Text>
    </HStack>
  );
}
