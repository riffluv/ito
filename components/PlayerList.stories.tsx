import type { Meta, StoryObj } from '@storybook/react';
import { PlayerList } from './PlayerList';

const meta: Meta<typeof PlayerList> = {
  title: 'Lists/PlayerList',
  component: PlayerList,
  argTypes: {
    myId: { control: 'text' },
  },
  args: {
    myId: 'u1',
  },
};

export default meta;
type Story = StoryObj<typeof PlayerList>;

const players = [
  { id: 'u1', uid: 'u1', name: 'たろう', clue1: '寿司', ready: true, number: 12 },
  { id: 'u2', uid: 'u2', name: 'hanako', clue1: 'ケーキ', ready: false },
  { id: 'u3', uid: 'u3', name: 'jiro', clue1: '', ready: false },
] as any[];

export const Default: Story = {
  args: {
    players,
    online: ['u1', 'u2'],
  },
};

