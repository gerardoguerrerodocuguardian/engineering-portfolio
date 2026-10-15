import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { renderApp, signedIn } from '@/test/render';
import { createCampaignSchema } from './schema';

describe('campaigns feature', () => {
  it('shows a skeleton then the first page, and paginates', async () => {
    signedIn();
    renderApp('/campaigns');
    expect(await screen.findByRole('rowheader', { name: 'Spring Launch' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(6); // header + 5
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'App Install Push' })).toBeInTheDocument();
  });

  it('filters by status via the URL', async () => {
    signedIn();
    renderApp('/campaigns');
    await screen.findByRole('rowheader', { name: 'Spring Launch' });
    await userEvent.setup().selectOptions(screen.getByLabelText(/Status/), 'DRAFT');
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'Spring Launch' })).not.toBeInTheDocument());
    expect(screen.getByRole('rowheader', { name: 'Autumn Clearance' })).toBeTruthy();
  });

  it('optimistically updates the status and keeps it when the server agrees', async () => {
    signedIn();
    renderApp('/campaigns');
    await screen.findByRole('rowheader', { name: 'Spring Launch' });
    const user = userEvent.setup();
    expect(screen.getByTestId('status-cmp-001')).toHaveTextContent('Active');
    await user.click(screen.getByRole('button', { name: /Pause Spring Launch/ }));
    expect(screen.getByTestId('status-cmp-001')).toHaveTextContent('Paused'); // before the response
    expect(await screen.findByText('Campaign updated.')).toBeInTheDocument();
    expect(screen.getByTestId('status-cmp-001')).toHaveTextContent('Paused');
  });

  it('rolls back the optimistic update and announces the failure when the server errors', async () => {
    signedIn();
    server.use(http.patch('*/v1/campaigns/:id', () => HttpResponse.json({ type: 'about:blank', title: 'boom', status: 500 }, { status: 500 })));
    renderApp('/campaigns');
    await screen.findByRole('rowheader', { name: 'Spring Launch' });
    await userEvent.setup().click(screen.getByRole('button', { name: /Pause Spring Launch/ }));
    expect(await screen.findByText('Could not update the campaign. The change was rolled back.')).toBeInTheDocument();
    expect(screen.getByTestId('status-cmp-001')).toHaveTextContent('Active');
  });

  it('validates and creates a campaign (form + zod + mutation + refetch)', async () => {
    signedIn();
    renderApp('/campaigns');
    await screen.findByRole('rowheader', { name: 'Spring Launch' });
    const user = userEvent.setup();
    const form = screen.getByRole('form', { name: 'New campaign' });
    await user.type(within(form).getByLabelText('Name'), 'ab');
    await user.click(within(form).getByRole('button', { name: 'Create campaign' }));
    expect(await within(form).findByText('Name must be between 3 and 120 characters.')).toBeInTheDocument();

    await user.clear(within(form).getByLabelText('Name'));
    await user.type(within(form).getByLabelText('Name'), 'Winter Promo');
    await user.type(within(form).getByLabelText('Daily budget (USD)'), '25');
    await user.type(within(form).getByLabelText('Max bid (USD)'), '0.5');
    await user.click(within(form).getByRole('button', { name: 'Create campaign' }));
    expect(await screen.findByText('Campaign created.')).toBeInTheDocument();
    expect(await screen.findByRole('rowheader', { name: 'Winter Promo' })).toBeInTheDocument();
  });

  it('renders Spanish and an error boundary with retry when the list fails', async () => {
    signedIn();
    let fail = true;
    server.use(
      http.get('*/v1/campaigns', () => {
        if (fail) return HttpResponse.json({ type: 'about:blank', title: 'down', status: 400 }, { status: 400 });
        return undefined; // fall through to the default handler
      }),
    );
    renderApp('/campaigns', { locale: 'es' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal');
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('rowheader', { name: 'Spring Launch' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Campañas' })).toBeInTheDocument();
  });
});

describe('createCampaignSchema (contract constraints)', () => {
  it('mirrors CreateCampaign limits', () => {
    expect(createCampaignSchema.safeParse({ name: 'abc', dailyBudget: 0, maxBid: 0.01 }).success).toBe(true);
    expect(createCampaignSchema.safeParse({ name: 'abc', dailyBudget: -1, maxBid: 0.01 }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ name: 'abc', dailyBudget: 1, maxBid: 0 }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ name: 'x'.repeat(121), dailyBudget: 1, maxBid: 1 }).success).toBe(false);
  });
});
