import type { Decorator, Preview } from '@storybook/react-vite';
import '../src/styles/tokens.css';
import '../src/styles/components.css';

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme as string;
  document.documentElement.dataset.theme = theme;
  return (
    <div style={{ background: 'var(--adf-color-bg)', color: 'var(--adf-color-fg)', padding: 16, fontFamily: 'var(--adf-font-family)' }}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Design-token theme',
      toolbar: { title: 'Theme', icon: 'paintbrush', items: ['light', 'dark', 'high-contrast'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' }, // axe violations fail the story in the Storybook UI / test runner
  },
  tags: ['autodocs'],
};
export default preview;
