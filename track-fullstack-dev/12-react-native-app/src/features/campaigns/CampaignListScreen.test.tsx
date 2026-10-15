import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createHarness, renderScreen } from '@/test/utils';
import { CampaignListScreen } from './CampaignListScreen';

describe('CampaignListScreen', () => {
  it('shows the first page with accessible rows and opens a campaign', async () => {
    const onOpen = jest.fn();
    renderScreen(<CampaignListScreen onOpen={onOpen} />, createHarness({ count: 45 }));

    const row = await screen.findByLabelText(/^Spring push 1, draft/);
    expect(screen.getByText('20 of 45 campaigns')).toBeTruthy();
    fireEvent.press(row);
    expect(onOpen).toHaveBeenCalledWith('cmp-001');
  });

  it('loads the next page when the end is reached', async () => {
    renderScreen(<CampaignListScreen onOpen={jest.fn()} />, createHarness({ count: 45 }));
    const list = await screen.findByTestId('campaign-list');
    fireEvent(list, 'endReached');
    await waitFor(() => expect(screen.getByText('40 of 45 campaigns')).toBeTruthy());
  });

  it('refetches on pull-to-refresh', async () => {
    const h = createHarness({ count: 3 });
    renderScreen(<CampaignListScreen onOpen={jest.fn()} />, h);
    const list = await screen.findByTestId('campaign-list');
    h.server.campaigns.push({ ...h.server.campaigns[0]!, id: 'cmp-new', name: 'Brand new' });

    fireEvent(list, 'refresh');
    expect(await screen.findByText('4 of 4 campaigns')).toBeTruthy();
  });

  it('shows an error with retry when nothing is cached', async () => {
    const h = createHarness();
    h.services.api.listCampaigns = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue({
      items: [], page: 1, pageSize: 20, total: 0,
    });
    renderScreen(<CampaignListScreen onOpen={jest.fn()} />, h);
    fireEvent.press(await screen.findByLabelText('Try again'));
    expect(await screen.findByText('0 of 0 campaigns')).toBeTruthy();
  });
});
