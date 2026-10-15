import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createHarness, renderScreen } from '@/test/utils';
import { CampaignDetailScreen } from './CampaignDetailScreen';

describe('CampaignDetailScreen', () => {
  it('renders details and an accessible report chart', async () => {
    renderScreen(<CampaignDetailScreen id="cmp-002" />, createHarness());
    expect(await screen.findByText('Summer push 2')).toBeTruthy();
    const chart = await screen.findByLabelText(/^Report chart\. Impressions: 12,634/);
    expect(chart.props.accessibilityLabel).toContain('Click-through rate');
  });

  it('pauses optimistically and the button flips to Resume', async () => {
    const h = createHarness();
    renderScreen(<CampaignDetailScreen id="cmp-002" />, h);
    fireEvent.press(await screen.findByLabelText('Pause'));
    await waitFor(() => expect(screen.getByLabelText('Status: Paused')).toBeTruthy());
    await waitFor(() => expect(h.server.campaigns[1]!.status).toBe('PAUSED'));
    expect(await screen.findByLabelText('Resume')).toBeTruthy();
  });

  it('reverts and tells the user when the server fails', async () => {
    const h = createHarness({ failNextPatches: 1 });
    renderScreen(<CampaignDetailScreen id="cmp-002" />, h);
    fireEvent.press(await screen.findByLabelText('Pause'));
    expect(await screen.findByText('Could not update the campaign. The change was reverted.')).toBeTruthy();
    expect(screen.getByLabelText('Status: Active')).toBeTruthy();
    expect(screen.getByLabelText('Pause')).toBeTruthy();
  });

  it('offers no toggle for drafts', async () => {
    renderScreen(<CampaignDetailScreen id="cmp-001" />, createHarness());
    expect(await screen.findByLabelText('Status: Draft')).toBeTruthy();
    expect(screen.queryByLabelText('Pause')).toBeNull();
    expect(screen.queryByLabelText('Resume')).toBeNull();
  });
});
