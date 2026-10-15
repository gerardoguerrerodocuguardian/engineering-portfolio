import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { TextField } from './TextField';

describe('TextField', () => {
  it('has no axe violations (plain, described, invalid, required)', async () => {
    const { container } = render(
      <form>
        <TextField label="Campaign name" />
        <TextField label="Budget" description="In synthetic credits" required />
        <TextField label="Email" error="Enter a valid email" defaultValue="x" />
      </form>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('associates label, description and error with the input', () => {
    render(<TextField label="Budget" description="Per day" error="Too high" />);
    const input = screen.getByLabelText('Budget');
    expect(input).toHaveAccessibleDescription('Per day Too high');
    expect(input).toBeInvalid();
  });

  it('supports uncontrolled typing', async () => {
    const user = userEvent.setup();
    render(<TextField label="Name" defaultValue="A" />);
    await user.type(screen.getByLabelText('Name'), 'BC');
    expect(screen.getByLabelText('Name')).toHaveValue('ABC');
  });

  it('supports controlled typing', async () => {
    function Controlled() {
      const [v, setV] = useState('');
      return <TextField label="Name" value={v} onChange={(e) => setV(e.target.value.toUpperCase())} />;
    }
    const user = userEvent.setup();
    render(<Controlled />);
    await user.type(screen.getByLabelText('Name'), 'ab');
    expect(screen.getByLabelText('Name')).toHaveValue('AB');
  });
});
