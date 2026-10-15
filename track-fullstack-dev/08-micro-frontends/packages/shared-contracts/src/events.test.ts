import { describe, expect, it, vi } from 'vitest';
import { createEventBus, getEventBus } from './events';
import { staticTokenProvider } from './auth';

describe('event bus', () => {
  it('delivers typed payloads to subscribers', () => {
    const bus = createEventBus(new EventTarget());
    const h = vi.fn();
    bus.on('campaign:selected', h);
    bus.emit('campaign:selected', { campaignId: 'c1', name: 'Spring' });
    expect(h).toHaveBeenCalledWith({ campaignId: 'c1', name: 'Spring' });
  });
  it('unsubscribes', () => {
    const bus = createEventBus(new EventTarget());
    const h = vi.fn();
    const off = bus.on('auth:signed-out', h);
    off();
    bus.emit('auth:signed-out', {});
    expect(h).not.toHaveBeenCalled();
  });
  it('keeps the last value for late subscribers', () => {
    const bus = createEventBus(new EventTarget());
    expect(bus.last('campaign:selected')).toBeUndefined();
    bus.emit('campaign:selected', { campaignId: 'c2', name: 'Fall' });
    expect(bus.last('campaign:selected')?.campaignId).toBe('c2');
  });
  it('does not mix event names', () => {
    const bus = createEventBus(new EventTarget());
    const h = vi.fn();
    bus.on('campaign:status-changed', h);
    bus.emit('campaign:selected', { campaignId: 'c', name: 'n' });
    expect(h).not.toHaveBeenCalled();
  });
  it('getEventBus returns one shared instance per target (across bundle copies)', () => {
    const t = new EventTarget();
    expect(getEventBus(t)).toBe(getEventBus(t));
  });
});

describe('token provider', () => {
  it('static provider exposes token and user', async () => {
    const p = staticTokenProvider('tok', { id: 'u', name: 'Demo' });
    expect(await p.getToken()).toBe('tok');
    expect(p.getUser()?.name).toBe('Demo');
  });
});
