import CompareClient from "./CompareClient";
import { Box } from "@chakra-ui/react";
import { promises as fs } from "fs";
import path from "path";

export default async function ComparePage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const filePath = path.join(process.cwd(), "public", "design", "reference", `${slug}.html`);
  let html = "<div>Reference HTML not found.</div>";
  try {
    html = await fs.readFile(filePath, "utf-8");
  } catch {}
  return (
    <Box p={6} maxW="7xl" mx="auto">
      <CompareClient slug={slug} html={html} />
    </Box>
  );
}

