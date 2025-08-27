import type { Meta, StoryObj } from '@storybook/react';
import BoardArea from './BoardArea';
import { GameCard } from './GameCard';

const meta: Meta<typeof BoardArea> = {
  title: 'Game/BoardArea',
  component: BoardArea,
  argTypes: {
    isOver: { control: 'boolean' },
    droppable: { control: 'boolean' },
  },
  args: {
    isOver: false,
    droppable: true,
  },
};

export default meta;
type Story = StoryObj<typeof BoardArea>;

export const Default: Story = {
  render: (args) => (
    <BoardArea {...args}>
      <GameCard index={0} name="たろう" clue="ラーメン" number={24} />
      <GameCard index={1} name="はなこ" clue="おにぎり" number={56} />
    </BoardArea>
  ),
};

