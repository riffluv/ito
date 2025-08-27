import { Box, Link, Stack, Text } from "@chakra-ui/react";
import { promises as fs } from "fs";
import path from "path";

export default function CompareIndex() {
  return (
    <Box p={6} maxW="4xl" mx="auto">
      <Stack gap={3}>
        <Text fontWeight="bold">Design Compare (一覧)</Text>
        <Text color="fgMuted">デザイン比較機能は準備中です。</Text>
      </Stack>
    </Box>
  );
}
