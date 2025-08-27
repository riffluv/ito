import type { Meta, StoryObj } from '@storybook/react';
import { GameCard } from './GameCard';

const meta: Meta<typeof GameCard> = {
  title: 'Game/GameCard',
  component: GameCard,
  argTypes: {
    variant: { control: 'select', options: ['flat', 'flip'] },
    state: { control: 'select', options: ['default', 'success', 'fail'] },
    flipped: { control: 'boolean' },
  },
  args: {
    name: 'Taro',
    clue: 'おにぎり',
    number: 42,
    index: 0,
    variant: 'flat',
    state: 'default',
    flipped: false,
  },
};

export default meta;
type Story = StoryObj<typeof GameCard>;

export const Playground: Story = {};

export const States: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <GameCard {...args} state="default" />
      <GameCard {...args} state="success" />
      <GameCard {...args} state="fail" />
    </div>
  ),
};

