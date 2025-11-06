import type { Meta, StoryObj } from "@storybook/react";
import { Box, Text } from "@chakra-ui/react";

import { RoomView } from "./RoomView";
import type { RoomViewProps } from "./types";

const meta: Meta<typeof RoomView> = {
  title: "Rooms/RoomView",
  component: RoomView,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "ルーム画面の主要レイアウトを Storybook で検証するためのコンポーネントです。" +
          " 観戦モードとプレイヤーモードを切り替えて UI の配置を確認できます。",
      },
    },
  },
  argTypes: {
    roomId: { control: false },
    room: { control: false },
    nodes: { control: false },
    overlays: { control: false },
    chat: { control: false },
    passwordDialog: { control: false },
    settings: { control: false },
    ledger: { control: false },
    me: { control: false },
    onDealRecoveryDismiss: { control: false },
    onSubmitName: { control: false },
    showNotifyBridge: {
      control: { type: "boolean" },
      description: "通知ブリッジ（Firestore購読）を有効化するかどうか",
    },
    isSpectatorMode: {
      control: { type: "boolean" },
      description: "観戦モードとして UI を描画するか",
    },
    meHasPlacedCard: {
      control: { type: "boolean" },
      description: "自分がカードを提出済みかどうか",
    },
    dealRecoveryOpen: {
      control: { type: "boolean" },
      description: "配布リカバリーダイアログの表示",
    },
    needName: {
      control: { type: "boolean" },
      description: "名前入力ダイアログの表示",
    },
  },
};

export default meta;

type Story = StoryObj<typeof RoomView>;

const mockPlayers: RoomViewProps["chat"]["players"] = [
  {
    id: "player-1",
    name: "勇者アキ",
    avatar: "hero",
    number: 12,
    clue1: "火炎の剣",
    ready: true,
    orderIndex: 0,
  },
  {
    id: "player-2",
    name: "賢者リオ",
    avatar: "sage",
    number: 55,
    clue1: "雷鳴の書",
    ready: false,
    orderIndex: 1,
  },
];

const baseRoom: RoomViewProps["room"] = {
  id: "room-123",
  name: "序の紋章 III",
  hostId: "player-1",
  creatorId: "player-1",
  options: {
    allowContinueAfterFail: true,
    resolveMode: "sort-submit",
    defaultTopicType: "通常版",
  },
  status: "waiting",
  topic: "宇宙に関するもの",
  topicBox: "通常版",
  order: {
    list: mockPlayers.map((p) => p.id),
    proposal: mockPlayers.map((p) => p.id),
    failed: false,
    snapshots: null,
    numbers: null,
  },
  result: null,
  deal: null,
  round: 1,
  mvpVotes: null,
  ui: {
    recallOpen: true,
  },
};

const overlayBanner = (
  <Box
    position="fixed"
    top="12px"
    right="16px"
    zIndex={1200}
    padding="10px 14px"
    background="rgba(8, 12, 20, 0.82)"
    border="1px solid rgba(255,255,255,0.18)"
    color="rgba(255,255,255,0.9)"
    fontSize="13px"
  >
    再接続中…
  </Box>
);

const sidebarMock = (
  <Box p={4} border="1px solid rgba(255,255,255,0.2)">
    <Text>サイドバー（パーティ情報など）</Text>
  </Box>
);

const mainMock = (
  <Box p={4} border="1px solid rgba(255,255,255,0.2)">
    <Text>メイン領域（ボードやモニター表示）</Text>
  </Box>
);

const handMock = (
  <Box p={4} border="1px dashed rgba(255,255,255,0.3)">
    <Text>手札コンポーネントのプレースホルダー</Text>
  </Box>
);

const baseArgs: Partial<RoomViewProps> = {
  roomId: baseRoom.id,
  room: baseRoom,
  nodes: {
    header: undefined,
    sidebar: sidebarMock,
    main: mainMock,
    handArea: handMock,
  },
  overlays: {
    joinStatusBanner: overlayBanner,
    safeUpdateBannerNode: null,
    versionMismatchOverlay: null,
  },
  dealRecoveryOpen: false,
  onDealRecoveryDismiss: () => undefined,
  needName: false,
  onSubmitName: () => undefined,
  simplePhase: {
    status: baseRoom.status,
    canStartSorting: false,
    topic: baseRoom.topic ?? null,
  },
  chat: {
    players: mockPlayers,
    hostId: baseRoom.hostId,
    isFinished: false,
    onOpenLedger: () => undefined,
  },
  passwordDialog: {
    isOpen: false,
    roomName: baseRoom.name,
    isLoading: false,
    error: null,
    onSubmit: async () => undefined,
    onCancel: () => undefined,
  },
  settings: {
    isOpen: false,
    onClose: () => undefined,
    options: baseRoom.options,
    isHost: true,
    roomStatus: baseRoom.status,
  },
  ledger: {
    isOpen: false,
    onClose: () => undefined,
    players: mockPlayers,
    orderList: baseRoom.order?.list ?? [],
    topic: baseRoom.topic ?? null,
    failed: false,
    roomId: baseRoom.id,
    myId: mockPlayers[0].id,
    mvpVotes: null,
  },
  showNotifyBridge: false,
};

const Template = (args: RoomViewProps) => <RoomView {...args} />;

export const PlayerView: Story = {
  render: Template,
  args: {
    ...baseArgs,
    me: mockPlayers[0],
    isSpectatorMode: false,
    meHasPlacedCard: false,
  } as RoomViewProps,
};

export const SpectatorView: Story = {
  render: Template,
  args: {
    ...baseArgs,
    room: {
      ...baseRoom,
      status: "waiting",
      ui: { recallOpen: true },
    },
    nodes: {
      header: undefined,
      sidebar: sidebarMock,
      main: (
        <Box p={4} border="1px solid rgba(255,255,255,0.2)" bg="rgba(0,0,0,0.3)">
          <Text>観戦メインビュー</Text>
        </Box>
      ),
      handArea: (
        <Box p={4} border="1px dashed rgba(255,255,255,0.3)">
          <Text>観戦者は手札を表示しません</Text>
        </Box>
      ),
    },
    me: null,
    isSpectatorMode: true,
    meHasPlacedCard: false,
  } as RoomViewProps,
};

export const ControlsPlayground: Story = {
  render: Template,
  args: {
    ...baseArgs,
    me: mockPlayers[0],
    isSpectatorMode: false,
    meHasPlacedCard: false,
  } as RoomViewProps,
  parameters: {
    docs: {
      description: {
        story: "Controls で観戦/参加を切り替えながら UI の差分を確認できます。",
      },
    },
  },
};
