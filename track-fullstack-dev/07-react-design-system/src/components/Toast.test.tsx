import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { ToastProvider, useToast, type ToastOptions } from './Toast';

function Trigger({ options }: { options: ToastOptions }) {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast(options)}>
      Notify
    </button>
  );
}

describe('Toast', () => {
  it('has no axe violations with visible toasts', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger options={{ title: 'Saved', description: 'Campaign updated', tone: 'success' }} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('uses role=alert for danger and a labelled landmark region', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger options={{ title: 'Payment failed', tone: 'danger' }} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Payment failed');
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('dismisses with the keyboard-reachable close button', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger options={{ title: 'Hello', duration: Infinity }} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await screen.findByRole('status');
    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('auto-dismisses after the duration and pauses while hovered', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <ToastProvider>
          <Trigger options={{ title: 'Soon gone', duration: 1000 }} />
        </ToastProvider>,
      );
      await user.click(screen.getByRole('button', { name: 'Notify' }));
      const toast = await screen.findByRole('status');
      await user.hover(toast);
      act(() => void vi.advanceTimersByTime(5000));
      expect(screen.getByRole('status')).toBeInTheDocument();
      await user.unhover(toast);
      act(() => void vi.advanceTimersByTime(1100));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws a helpful error outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger options={{ title: 'x' }} />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
