import { Box, Link, Stack, Text } from "@chakra-ui/react";
import { promises as fs } from "fs";
import path from "path";

export default async function CompareIndex() {
  const filePath = path.join(process.cwd(), "public", "design", "reference", "index.json");
  let files: string[] = [];
  try {
    const json = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(json) as { files: string[] };
    files = data.files || [];
  } catch {}

  return (
    <Box p={6} maxW="4xl" mx="auto">
      <Stack gap={3}>
        <Text fontWeight="bold">Design Compare (一覧)</Text>
        {files.length === 0 ? (
          <Text color="fgMuted">`public/design/reference` にHTMLを置いてください。</Text>
        ) : (
          files.map((f) => (
            <Link key={f} href={`/design/compare/${f}`} color="link">
              {f}
            </Link>
          ))
        )}
      </Stack>
    </Box>
  );
}
