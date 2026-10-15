import { describe, expect, it } from 'vitest';
import { getEventBus } from '@adflow/shared-contracts';
import './main';
import { fakeReport } from './main';

describe('<adflow-reports>', () => {
  it('is deterministic', () => expect(fakeReport('c-1')).toEqual(fakeReport('c-1')));
  it('renders the selected campaign received through the bus and escapes HTML', () => {
    const el = document.createElement('adflow-reports');
    document.body.append(el);
    expect(el.shadowRoot!.textContent).toContain('Select a campaign');
    getEventBus().emit('campaign:selected', { campaignId: 'c-9', name: '<b>X</b>' });
    expect(el.shadowRoot!.querySelector('strong')!.textContent).toBe('<b>X</b>');
    expect(el.shadowRoot!.querySelector('b')).toBeNull();
    el.remove();
  });
});
