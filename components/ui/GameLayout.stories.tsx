import type { Meta, StoryObj } from '@storybook/react';
import GameLayout from './GameLayout';
import { Box, Text } from '@chakra-ui/react';

const meta: Meta<typeof GameLayout> = {
  title: 'Layouts/GameLayout',
  component: GameLayout,
};

export default meta;
type Story = StoryObj<typeof GameLayout>;

const Header = (
  <Box px={4} display="flex" alignItems="center" w="full">
    <Text fontWeight="bold">Header</Text>
  </Box>
);

const Sidebar = (
  <Box p={3}>
    <Text>Sidebar</Text>
  </Box>
);

const Right = (
  <Box p={3}>
    <Text>Right Panel</Text>
  </Box>
);

const Hand = (
  <Box p={3}>
    <Text>Hand Area</Text>
  </Box>
);

const Main = (
  <Box p={3}>
    <Text>Main Content</Text>
  </Box>
);

export const WithAll: Story = {
  args: {
    header: Header,
    sidebar: Sidebar,
    rightPanel: Right,
    handArea: Hand,
    main: Main,
  },
};

export const NoSidebars: Story = {
  args: {
    header: Header,
    handArea: Hand,
    main: Main,
  },
};

