import { createStubPushService } from './pushService';

describe('stub push service', () => {
  it('grants once and keeps the answer', async () => {
    const push = createStubPushService();
    expect(await push.getPermission()).toBe('undetermined');
    expect(await push.requestPermission()).toBe('granted');
    expect(await push.requestPermission()).toBe('granted');
  });

  it('a denial is final', async () => {
    const push = createStubPushService({ willGrant: false });
    expect(await push.requestPermission()).toBe('denied');
    expect(await push.requestPermission()).toBe('denied');
  });
});
