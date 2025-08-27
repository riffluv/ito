import React, { useEffect } from 'react';
import type { Preview } from '@storybook/react';
import { ChakraProvider, Box } from '@chakra-ui/react';
import system from '../theme';
import { ThemeProvider } from 'next-themes';

// global toolbar for light/dark
export const globalTypes = {
  theme: {
    name: 'Theme',
    description: 'Global theme for components',
    defaultValue: 'light',
    toolbar: {
      icon: 'circlehollow',
      items: [
        { value: 'light', title: 'Light' },
        { value: 'dark', title: 'Dark' },
      ],
      dynamicTitle: true,
    },
  },
};

const withProviders = (Story, context) => {
  const mode = context.globals.theme || 'light';
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-theme', mode);
  }, [mode]);

  return (
    <ChakraProvider value={system}>
      <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
        <Box bg="canvasBg" color="fgDefault" minH="100vh" p={4}>
          <Story />
        </Box>
      </ThemeProvider>
    </ChakraProvider>
  );
};

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    layout: 'fullscreen',
    backgrounds: { disable: true },
  },
  decorators: [withProviders],
};

export default preview;

