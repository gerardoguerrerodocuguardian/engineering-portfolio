import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('has no axe violations and is hidden from assistive tech inside a busy container', async () => {
    const { container } = render(
      <section aria-busy="true" aria-label="Campaigns">
        <Skeleton width="10rem" />
        <Skeleton circle height="2rem" />
      </section>,
    );
    expect(await axe(container)).toHaveNoViolations();
    const [rect, circle] = container.querySelectorAll('.adf-skeleton');
    expect(rect).toHaveAttribute('aria-hidden', 'true');
    expect(circle).toHaveAttribute('data-shape', 'circle');
    expect((circle as HTMLElement).style.width).toBe('2rem');
  });
});
