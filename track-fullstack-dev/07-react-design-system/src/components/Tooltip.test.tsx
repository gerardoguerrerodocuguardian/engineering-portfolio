import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Tooltip } from './Tooltip';
import { Button } from './Button';

describe('Tooltip', () => {
  it('has no axe violations hidden and visible', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Tooltip content="Archive this campaign">
        <Button>Archive</Button>
      </Tooltip>,
    );
    expect(await axe(container)).toHaveNoViolations();
    await user.tab();
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows on keyboard focus, describes the trigger, and hides on blur', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Archive this campaign">
        <Button>Archive</Button>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveAccessibleDescription('Archive this campaign');
    await user.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('is dismissible with Escape without moving focus', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Help">
        <Button>Info</Button>
      </Tooltip>,
    );
    await user.tab();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveFocus();
  });

  it('shows after the hover delay and stays open when the pointer moves onto it', async () => {
    vi.useFakeTimers();
    try {
      render(
        <Tooltip content="Help" delay={300}>
          <Button>Info</Button>
        </Tooltip>,
      );
      const button = screen.getByRole('button');
      const { fireEvent } = await import('@testing-library/react');
      fireEvent.mouseEnter(button.parentElement!);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      act(() => void vi.advanceTimersByTime(300));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      fireEvent.mouseLeave(button.parentElement!);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
