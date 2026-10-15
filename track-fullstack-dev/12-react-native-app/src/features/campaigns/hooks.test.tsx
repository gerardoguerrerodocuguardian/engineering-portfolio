import { act, waitFor } from '@testing-library/react-native';
import type { InfiniteData } from '@tanstack/react-query';
import type { Campaign, CampaignPage } from '@/api/types';
import { createHarness, renderHookWith } from '@/test/utils';
import { useCampaign, useCampaignList, useToggleCampaignStatus } from './hooks';
import { campaignKeys } from './queryKeys';

function statusInList(data: InfiniteData<CampaignPage> | undefined, id: string) {
  return data?.pages.flatMap((p) => p.items).find((c) => c.id === id)?.status;
}

describe('useCampaignList', () => {
  it('paginates until total is reached', async () => {
    const h = createHarness({ count: 45 });
    const { result } = renderHookWith(() => useCampaignList(), h);

    await waitFor(() => expect(result.current.campaigns).toHaveLength(20));
    expect(result.current.total).toBe(45);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.campaigns).toHaveLength(40));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.campaigns).toHaveLength(45));
    expect(result.current.hasMore).toBe(false);
  });

  it('keeps cached data and flags it as stale when a refresh fails', async () => {
    const h = createHarness({ count: 5 });
    const { result } = renderHookWith(() => useCampaignList(), h);
    await waitFor(() => expect(result.current.campaigns).toHaveLength(5));

    h.server.fetch = async () => new Response('{}', { status: 503 });
    h.services.api.listCampaigns = () => Promise.reject(new Error('offline'));
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.isShowingStale).toBe(true));
    expect(result.current.campaigns).toHaveLength(5);
    expect(result.current.error).toBeNull();
  });
});

describe('useToggleCampaignStatus', () => {
  async function setup(failNextPatches = 0) {
    const h = createHarness({ count: 5, failNextPatches });
    const list = renderHookWith(() => useCampaignList(), h);
    await waitFor(() => expect(list.result.current.campaigns).toHaveLength(5));
    const detail = renderHookWith(() => useCampaign('cmp-002'), h);
    await waitFor(() => expect(detail.result.current.data?.status).toBe('ACTIVE'));
    const toggle = renderHookWith(() => useToggleCampaignStatus('cmp-002'), h);
    return { h, toggle };
  }

  it('updates detail and list caches optimistically, then settles on the server value', async () => {
    const { h, toggle } = await setup();

    act(() => toggle.result.current.mutate('PAUSED'));
    await waitFor(() => {
      expect(h.queryClient.getQueryData<Campaign>(campaignKeys.detail('cmp-002'))?.status).toBe('PAUSED');
    });
    expect(statusInList(h.queryClient.getQueryData(campaignKeys.list()), 'cmp-002')).toBe('PAUSED');

    await waitFor(() => expect(toggle.result.current.isSuccess).toBe(true));
    expect(h.server.campaigns[1]!.status).toBe('PAUSED');
  });

  it('rolls back both caches when the server rejects the change', async () => {
    const { h, toggle } = await setup(1);
    let seenOptimistic = false;
    const unsubscribe = h.queryClient.getQueryCache().subscribe(() => {
      if (h.queryClient.getQueryData<Campaign>(campaignKeys.detail('cmp-002'))?.status === 'PAUSED') seenOptimistic = true;
    });

    act(() => toggle.result.current.mutate('PAUSED'));
    await waitFor(() => expect(toggle.result.current.isError).toBe(true));
    unsubscribe();

    expect(seenOptimistic).toBe(true);
    expect(h.queryClient.getQueryData<Campaign>(campaignKeys.detail('cmp-002'))?.status).toBe('ACTIVE');
    expect(statusInList(h.queryClient.getQueryData(campaignKeys.list()), 'cmp-002')).toBe('ACTIVE');
    expect(h.server.campaigns[1]!.status).toBe('ACTIVE');
  });
});
