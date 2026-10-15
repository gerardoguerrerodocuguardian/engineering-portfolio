import { fireEvent, screen } from '@testing-library/react-native';
import { createStubPushService } from '@/core/pushService';
import { createHarness, renderScreen } from '@/test/utils';
import { NotificationPrompt } from './NotificationPrompt';

describe('NotificationPrompt', () => {
  it('asks, then reflects the granted state and hides the button', async () => {
    renderScreen(<NotificationPrompt />, createHarness());
    fireEvent.press(await screen.findByLabelText('Enable notifications'));
    expect(await screen.findByText(/Push notifications are on/)).toBeTruthy();
    expect(screen.queryByLabelText('Enable notifications')).toBeNull();
  });

  it('explains how to recover after a denial and does not ask again', async () => {
    const h = createHarness({}, { push: createStubPushService({ initial: 'denied' }) });
    renderScreen(<NotificationPrompt />, h);
    expect(await screen.findByText(/Push notifications are off/)).toBeTruthy();
    expect(screen.queryByLabelText('Enable notifications')).toBeNull();
  });
});
