// Runs every story's `play` function (interaction test) in jsdom via Storybook portable stories.
import { composeStories } from '@storybook/react-vite';
import { configureAxe } from 'jest-axe';
import { clearAllMocks } from 'storybook/test';
import * as Button from './components/Button.stories';
import * as TextField from './components/TextField.stories';
import * as Select from './components/Select.stories';
import * as Dialog from './components/Dialog.stories';
import * as Tooltip from './components/Tooltip.stories';
import * as Tabs from './components/Tabs.stories';
import * as Table from './components/Table.stories';
import * as Toast from './components/Toast.stories';
import * as Badge from './components/Badge.stories';
import * as Skeleton from './components/Skeleton.stories';

// 'region' is a page-level rule; isolated stories are not full pages.
const axe = configureAxe({ rules: { region: { enabled: false } } });

beforeEach(() => clearAllMocks());

const suites = { Button, TextField, Select, Dialog, Tooltip, Tabs, Table, Toast, Badge, Skeleton };

describe.each(Object.entries(suites))('%s stories', (_name, module) => {
  const stories = Object.entries(composeStories(module as never) as Record<string, React.ComponentType & { run: (ctx?: { canvasElement: HTMLElement }) => Promise<void> }>);
  it.each(stories)('%s: play function passes and has no axe violations', async (_story, Story) => {
    const canvasElement = document.body.appendChild(document.createElement('div'));
    await Story.run({ canvasElement }); // renders the story and executes play()
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
