import { createRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Button } from './Button';

describe('Button', () => {
  it('has no axe violations in each variant', async () => {
    const { container } = render(
      <div>
        <Button>Save</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="danger" loading>
          Delete
        </Button>
        <Button asChild>
          <a href="/campaigns">Campaigns</a>
        </Button>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('forwards refs and defaults to type=button', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Go</Button>);
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Go' }));
    expect(ref.current).toHaveAttribute('type', 'button');
  });

  it('activates with Enter and Space', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);
    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('loading blocks clicks but stays focusable and announces busy', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving' });
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();
  });

  it('asChild renders the child element with merged props and handlers', async () => {
    const parent = vi.fn();
    const child = vi.fn();
    const user = userEvent.setup();
    render(
      <Button asChild onClick={parent} variant="secondary">
        <a href="#x" onClick={child}>
          Link
        </a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Link' });
    expect(link).toHaveClass('adf-button');
    expect(link).toHaveAttribute('data-variant', 'secondary');
    await user.click(link);
    expect(child).toHaveBeenCalled();
    expect(parent).toHaveBeenCalled();
  });

  it('works controlled inside a stateful parent', async () => {
    function Counter() {
      const [n, setN] = useState(0);
      return <Button onClick={() => setN(n + 1)}>Count {n}</Button>;
    }
    const user = userEvent.setup();
    render(<Counter />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('Count 1');
  });
});
