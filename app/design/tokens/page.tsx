import { Box, Grid, HStack, Stack, Text } from "@chakra-ui/react";

const colorTokens = [
  "--colors-canvasBg",
  "--colors-panelBg",
  "--colors-panelSubBg",
  "--colors-fgDefault",
  "--colors-fgMuted",
  "--colors-borderDefault",
  "--colors-accent",
  "--colors-accentSubtle",
  "--colors-focusRing",
  "--colors-dangerSolid",
  "--colors-successSolid",
  "--colors-link",
];

function TokenRow({ name }: { name: string }) {
  return (
    <HStack>
      <Box w={56} fontFamily="mono" fontSize="xs">{name}</Box>
      <Box flex={1} h={6} rounded="md" borderWidth="1px" borderColor="borderDefault" bg={`var(${name})`} />
    </HStack>
  );
}

export default function TokensPage() {
  return (
    <Box p={6} maxW="7xl" mx="auto">
      <Stack gap={6}>
        <Text fontWeight="bold">Semantic Color Tokens</Text>
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
          {colorTokens.map((n) => (
            <TokenRow key={n} name={n} />
          ))}
        </Grid>
      </Stack>
    </Box>
  );
}

