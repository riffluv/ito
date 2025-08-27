import type { Meta, StoryObj } from '@storybook/react';
import { Panel } from './Panel';
import { AppButton } from './AppButton';

const meta: Meta<typeof Panel> = {
  title: 'UI/Panel',
  component: Panel,
  argTypes: {
    variant: { control: 'select', options: ['surface', 'subtle', 'outlined', 'accent'] },
    elevated: { control: 'boolean' },
    density: { control: 'select', options: ['comfortable', 'compact'] },
  },
  args: {
    title: 'パネルタイトル',
    variant: 'surface',
    elevated: false,
    density: 'comfortable',
  },
};

export default meta;
type Story = StoryObj<typeof Panel>;

export const Playground: Story = {
  render: (args) => (
    <Panel {...args} actions={<AppButton variant="subtle" size="sm">操作</AppButton>}>
      これはコンテンツ領域です。semantic tokens とレシピの検証に使えます。
    </Panel>
  ),
};

