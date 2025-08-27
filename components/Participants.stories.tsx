import type { Meta, StoryObj } from '@storybook/react';
import { Participants } from './Participants';

const meta: Meta<typeof Participants> = {
  title: 'Lists/Participants',
  component: Participants,
};

export default meta;
type Story = StoryObj<typeof Participants>;

const sample = [
  { id: 'u1', name: 'たろう', clue1: 'おにぎり', ready: true },
  { id: 'u2', name: 'はなこ', clue1: 'カレー', ready: false },
  { id: 'u3', name: 'jiro', clue1: '', ready: false },
] as any[];

export const Default: Story = {
  args: { players: sample },
};

