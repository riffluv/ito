import type { Meta, StoryObj } from '@storybook/react';
import { AppButton } from './AppButton';

const meta: Meta<typeof AppButton> = {
  title: 'UI/AppButton',
  component: AppButton,
  argTypes: {
    visual: {
      control: 'select',
      options: ['solid', 'outline', 'ghost', 'subtle', 'surface', 'plain'],
    },
    palette: {
      control: 'select',
      options: ['brand', 'gray', 'danger', 'success'],
    },
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg'] },
  },
  args: {
    children: 'ボタン',
    visual: 'solid',
    palette: 'brand',
    size: 'md',
  },
};

export default meta;
type Story = StoryObj<typeof AppButton>;

export const Playground: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <AppButton {...args} visual="solid">Solid</AppButton>
      <AppButton {...args} visual="outline">Outline</AppButton>
      <AppButton {...args} visual="ghost">Ghost</AppButton>
      <AppButton {...args} visual="subtle">Subtle</AppButton>
      <AppButton {...args} visual="surface">Surface</AppButton>
      <AppButton {...args} visual="plain">Plain</AppButton>
    </div>
  ),
};

