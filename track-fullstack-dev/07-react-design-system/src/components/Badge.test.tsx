import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Badge } from './Badge';

describe('Badge', () => {
  it('has no axe violations for every tone', async () => {
    const { container } = render(
      <ul>
        {(['neutral', 'success', 'warning', 'info', 'danger'] as const).map((tone) => (
          <li key={tone}>
            <Badge tone={tone}>Status {tone}</Badge>
          </li>
        ))}
      </ul>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is polymorphic via `as` and keeps element-specific props typed', () => {
    render(
      <Badge as="a" href="/status" tone="info">
        Live
      </Badge>,
    );
    const link = screen.getByRole('link', { name: 'Live' });
    expect(link).toHaveAttribute('href', '/status');
    expect(link).toHaveAttribute('data-tone', 'info');
  });
});
