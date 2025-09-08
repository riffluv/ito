import { Box, ChakraProvider } from "@chakra-ui/react";
import type { Preview } from "@storybook/react";
import { useEffect } from "react";
import system from "../theme";
// ダークモード固定 - next-themes除去、globalTypes削除
// CLAUDE.mdに従いダークモード専用に確定

const withProviders = (Story, context) => {
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", "dark");
    html.classList.add("dark");
  }, []);

  return (
    <ChakraProvider value={system}>
      <Box bg="canvasBg" color="fgDefault" minH="100dvh" p={4}>
        <Story />
      </Box>
    </ChakraProvider>
  );
};

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    layout: "fullscreen",
    backgrounds: { disable: true },
  },
  decorators: [withProviders],
};

export default preview;
