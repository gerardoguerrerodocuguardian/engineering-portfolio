import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Tabs } from './Tabs';

function Example(props: Partial<React.ComponentProps<typeof Tabs>>) {
  return (
    <Tabs defaultValue="overview" {...props}>
      <Tabs.List aria-label="Campaign sections">
        <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
        <Tabs.Trigger value="creatives" disabled>
          Creatives
        </Tabs.Trigger>
        <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
        <Tabs.Trigger value="audit">Audit</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="overview">Overview panel</Tabs.Content>
      <Tabs.Content value="creatives">Creatives panel</Tabs.Content>
      <Tabs.Content value="billing">Billing panel</Tabs.Content>
      <Tabs.Content value="audit">Audit panel</Tabs.Content>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('has no axe violations', async () => {
    const { container } = render(<Example />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('wires tab/tabpanel roles and roving tabindex', () => {
    render(<Example />);
    const overview = screen.getByRole('tab', { name: 'Overview' });
    expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(overview).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Billing' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel', { name: 'Overview' })).toHaveTextContent('Overview panel');
    expect(screen.queryByText('Billing panel')).not.toBeVisible();
  });

  it('moves with arrows (wrapping, skipping disabled), Home and End, activating automatically', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Billing' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Billing' })).toBeVisible();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus(); // wrapped
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Audit' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus();
  });

  it('manual activation moves focus only until Enter', async () => {
    const user = userEvent.setup();
    render(<Example activationMode="manual" />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Billing' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tab', { name: 'Billing' })).toHaveAttribute('aria-selected', 'true');
  });

  it('uses Up/Down for vertical orientation and supports controlled value', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<Example orientation="vertical" value="overview" onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(onValueChange).toHaveBeenCalledWith('billing');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true'); // parent has not updated
  });
});
