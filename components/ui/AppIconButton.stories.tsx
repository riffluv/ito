import type { Meta, StoryObj } from '@storybook/react';
import { AppIconButton } from './AppIconButton';
import { ChevronDown, ChevronUp } from 'lucide-react';

const meta: Meta<typeof AppIconButton> = {
  title: 'UI/AppIconButton',
  component: AppIconButton,
  argTypes: {
    visual: {
      control: 'select',
      options: ['solid', 'outline', 'ghost', 'subtle', 'soft', 'link'],
    },
    palette: {
      control: 'select',
      options: ['brand', 'orange', 'gray'],
    },
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
  },
  args: {
    'aria-label': 'トグル',
    visual: 'ghost',
    palette: 'brand',
    size: 'sm',
  },
};

export default meta;
type Story = StoryObj<typeof AppIconButton>;

export const Playground: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <AppIconButton {...args}>
        <ChevronUp size={18} />
      </AppIconButton>
      <AppIconButton {...args}>
        <ChevronDown size={18} />
      </AppIconButton>
      <AppIconButton {...args} disabled>
        <ChevronDown size={18} />
      </AppIconButton>
    </div>
  ),
};

