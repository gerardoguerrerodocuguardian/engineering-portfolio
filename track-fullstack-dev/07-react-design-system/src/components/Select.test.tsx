import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Select } from './Select';

const options = [
  { value: 'search', label: 'Search' },
  { value: 'social', label: 'Social' },
  { value: 'video', label: 'Video', disabled: true },
  { value: 'display', label: 'Display' },
];

describe('Select', () => {
  it('has no axe violations closed and open', async () => {
    const { container } = render(<Select label="Channel" options={options} />);
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.setup().click(screen.getByRole('combobox'));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens with ArrowDown, skips disabled options, commits with Enter and returns focus state', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<Select label="Channel" options={options} onValueChange={onValueChange} />);
    const combo = screen.getByRole('combobox', { name: /Channel/ });
    await user.tab();
    expect(combo).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(combo).toHaveAttribute('aria-expanded', 'true');
    expect(combo).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Search' }).id);
    await user.keyboard('{ArrowDown}{ArrowDown}'); // social, then skips video -> display
    expect(combo).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Display' }).id);
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('display');
    expect(combo).toHaveAttribute('aria-expanded', 'false');
    expect(combo).toHaveTextContent('Display');
    expect(combo).toHaveFocus();
  });

  it('supports Home/End, Escape and typeahead', async () => {
    const user = userEvent.setup();
    render(<Select label="Channel" options={options} defaultValue="social" />);
    const combo = screen.getByRole('combobox');
    await user.tab();
    await user.keyboard('{ArrowDown}{End}');
    expect(combo).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Display' }).id);
    await user.keyboard('{Home}');
    expect(combo).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Search' }).id);
    await user.keyboard('{Escape}');
    expect(combo).toHaveAttribute('aria-expanded', 'false');
    expect(combo).toHaveTextContent('Social'); // Escape does not change the value
    await user.keyboard('d');
    expect(combo).toHaveAttribute('aria-expanded', 'true');
    expect(combo).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Display' }).id);
  });

  it('selects by mouse and marks aria-selected', async () => {
    const user = userEvent.setup();
    render(<Select label="Channel" options={options} name="channel" />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Social' }));
    expect(screen.getByRole('combobox')).toHaveTextContent('Social');
    expect(document.querySelector('input[name="channel"]')).toHaveValue('social');
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'Social' })).toHaveAttribute('aria-selected', 'true');
  });

  it('is controlled when value is provided', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Select label="Channel" options={options} value="search" onValueChange={onValueChange} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Social' }));
    expect(onValueChange).toHaveBeenCalledWith('social');
    expect(screen.getByRole('combobox')).toHaveTextContent('Search');
  });
});
