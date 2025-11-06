import type { Meta, StoryObj } from "@storybook/react";
import { HandAreaSection } from "./HandAreaSection";
import { Box, Text, VStack, HStack, Button, Badge } from "@chakra-ui/react";

const meta: Meta<typeof HandAreaSection> = {
  title: "Rooms/HandAreaSection",
  component: HandAreaSection,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "手札エリアと観戦UIのコンテナ。ホストパネル・観戦通知・プレイヤー手札の配置バランスを確認するためのストーリーです。",
      },
    },
  },
  argTypes: {
    hostPanel: { control: false },
    spectatorNotice: { control: false },
    handNode: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof HandAreaSection>;

const HostPanelMock = (
  <VStack
    border="1px solid rgba(255,255,255,0.3)"
    padding={4}
    align="stretch"
    spacing={3}
  >
    <HStack justify="space-between">
      <Text fontWeight="bold">観戦者の復帰申請</Text>
      <Badge colorScheme="orange">2 件</Badge>
    </HStack>
    <Button size="sm" colorScheme="green" width="100%">
      承認する
    </Button>
    <Button size="sm" colorScheme="red" width="100%" variant="outline">
      見送る
    </Button>
  </VStack>
);

const SpectatorNoticeMock = (
  <VStack
    border="1px solid rgba(255,255,255,0.3)"
    padding={4}
    spacing={3}
    align="stretch"
  >
    <Text fontWeight="bold">観戦モード</Text>
    <Text fontSize="sm" color="rgba(255,255,255,0.8)">
      席に戻る申請を待っています…
    </Text>
    <HStack spacing={3}>
      <Button size="sm" colorScheme="teal">
        席に戻れるか試す
      </Button>
      <Button size="sm" variant="outline">
        ロビーへ戻る
      </Button>
    </HStack>
  </VStack>
);

const HandNodeMock = (
  <Box border="1px dashed rgba(255,255,255,0.4)" padding={6}>
    <Text>MiniHandDock エリア（プレイヤーUI）</Text>
  </Box>
);

export const Default: Story = {
  args: {
    hostPanel: HostPanelMock,
    spectatorNotice: SpectatorNoticeMock,
    handNode: HandNodeMock,
  },
  parameters: {
    docs: {
      description: {
        story: "ホスト用申請パネル・観戦通知・手札が同時に表示される構成。",
      },
    },
  },
};

export const SpectatorOnly: Story = {
  args: {
    hostPanel: SpectatorNoticeMock,
    spectatorNotice: null,
    handNode: undefined,
  },
  parameters: {
    docs: {
      description: {
        story: "観戦者のみの UI。手札は非表示で観戦通知だけが並びます。",
      },
    },
  },
};

export const HandOnly: Story = {
  args: {
    hostPanel: null,
    spectatorNotice: null,
    handNode: HandNodeMock,
  },
};

export const EmptyState: Story = {
  args: {
    hostPanel: null,
    spectatorNotice: null,
    handNode: undefined,
  },
  parameters: {
    docs: {
      description: {
        story: "エリアが空の状態。観戦要素も手札も無いことを示します。",
      },
    },
  },
};
