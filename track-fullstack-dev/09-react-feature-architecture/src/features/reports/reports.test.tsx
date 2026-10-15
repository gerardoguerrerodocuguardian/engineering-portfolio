import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, signedIn } from '@/test/render';

describe('reports feature', () => {
  it('renders contract-shaped metrics', async () => {
    signedIn();
    renderApp('/reports/cmp-001');
    expect(await screen.findByText('Impressions')).toBeInTheDocument();
    expect(screen.getByText('15,000')).toBeInTheDocument();
    expect(screen.getByText('3.20%')).toBeInTheDocument();
  });

  it('shows the error boundary for an unknown campaign (404 problem)', async () => {
    signedIn();
    renderApp('/reports/nope');
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });
});
