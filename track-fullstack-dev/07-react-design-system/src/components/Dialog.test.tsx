import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Dialog } from './Dialog';

function Example({ onOpenChange }: { onOpenChange?: (o: boolean) => void }) {
  return (
    <>
      <button type="button">Before</button>
      <Dialog onOpenChange={onOpenChange}>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Pause campaign</Dialog.Title>
          <Dialog.Description>Spend stops immediately.</Dialog.Description>
          <input aria-label="Reason" />
          <Dialog.Close>Cancel</Dialog.Close>
          <button type="button">Confirm</button>
        </Dialog.Content>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('has no axe violations open and closed', async () => {
    const { container } = render(<Example />);
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('exposes an accessible modal dialog and moves focus inside', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pause campaign' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Spend stops immediately.');
    expect(screen.getByLabelText('Reason')).toHaveFocus();
  });

  it('traps focus with Tab and Shift+Tab', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await screen.findByRole('dialog');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Reason')).toHaveFocus(); // wrapped, never reached "Before"
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<Example onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('closes via Close button and overlay click, and locks body scroll while open', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await screen.findByRole('dialog');
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.click(document.querySelector('.adf-dialog__overlay')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('can be controlled', async () => {
    render(
      <Dialog open>
        <Dialog.Content>
          <Dialog.Title>Always open</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    expect(await screen.findByRole('dialog', { name: 'Always open' })).toBeInTheDocument();
  });
});
