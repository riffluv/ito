import type { PlayerDoc } from "@/lib/types";
import system from "@/theme";
import { ChakraProvider } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import MiniHandDock from "./MiniHandDock";

const meta: Meta<typeof MiniHandDock> = {
  title: "Game/MiniHandDock",
  component: MiniHandDock,
  decorators: [
    (Story) => (
      <ChakraProvider value={system}>
        <Story />
      </ChakraProvider>
    ),
  ],
  args: {
    roomId: "room1",
    resolveMode: "sequential",
    proposal: [],
    eligibleIds: ["u1", "u2", "u3"],
    cluesReady: true,
    isHost: true,
    roomStatus: "clue",
    defaultTopicType: "通常版",
  },
};
export default meta;

type Story = StoryObj<typeof MiniHandDock>;

const basePlayer: PlayerDoc & { id: string } = {
  id: "u1",
  name: "Alice",
  avatar: "a",
  number: 10,
  clue1: "",
  ready: true,
  orderIndex: 0,
};

export const Sequential: Story = {
  args: { me: { ...basePlayer }, resolveMode: "sequential" },
};

export const SortSubmitEmpty: Story = {
  args: { me: { ...basePlayer }, resolveMode: "sort-submit", proposal: [] },
};

export const SortSubmitPlaced: Story = {
  args: {
    me: { ...basePlayer },
    resolveMode: "sort-submit",
    proposal: ["u1", "u2", "u3"],
  },
};

export const WaitingHost: Story = {
  args: {
    me: { ...basePlayer },
    roomStatus: "waiting",
    resolveMode: "sequential",
  },
};

export const Finished: Story = {
  args: {
    me: { ...basePlayer },
    roomStatus: "finished",
    resolveMode: "sequential",
  },
};
