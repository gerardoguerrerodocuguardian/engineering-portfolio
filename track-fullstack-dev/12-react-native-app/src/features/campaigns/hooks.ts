import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useServices } from '@/core/services';
import type { Campaign, CampaignPage, CampaignStatus } from '@/api/types';
import { setStatusInPages, setStatusOnCampaign } from './cache';
import { flattenPages, nextStatus } from './domain';
import { campaignKeys } from './queryKeys';

export const PAGE_SIZE = 20;

export function useCampaignList() {
  const { api } = useServices();
  const query = useInfiniteQuery({
    queryKey: campaignKeys.list(),
    queryFn: ({ pageParam }) => api.listCampaigns({ page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  return {
    campaigns: flattenPages(query.data?.pages),
    total: query.data?.pages[0]?.total ?? 0,
    isLoading: query.isPending,
    isRefreshing: query.isRefetching && !query.isFetchingNextPage,
    isFetchingMore: query.isFetchingNextPage,
    hasMore: query.hasNextPage,
    /** True when a refresh failed but cached data is still shown (offline / flaky network). */
    isShowingStale: query.isError && query.data !== undefined,
    error: query.isError && query.data === undefined ? query.error : null,
    refresh: () => query.refetch(),
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
  };
}

export function useCampaign(id: string) {
  const { api } = useServices();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: () => api.getCampaign(id),
    // Render instantly from the list cache if we have it.
    initialData: () =>
      queryClient
        .getQueryData<InfiniteData<CampaignPage>>(campaignKeys.list())
        ?.pages.flatMap((p) => p.items)
        .find((c) => c.id === id),
    initialDataUpdatedAt: () => queryClient.getQueryState(campaignKeys.list())?.dataUpdatedAt,
  });
}

export function useCampaignReport(id: string) {
  const { api } = useServices();
  return useQuery({ queryKey: campaignKeys.report(id), queryFn: () => api.getCampaignReport(id) });
}

interface ToggleContext {
  previousDetail: Campaign | undefined;
  previousList: InfiniteData<CampaignPage> | undefined;
}

/** Pause/resume with optimistic update; rolls both caches back if the server rejects. */
export function useToggleCampaignStatus(id: string) {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return useMutation<Campaign, Error, CampaignStatus, ToggleContext>({
    mutationFn: (status) => api.updateCampaign(id, { status }),
    onMutate: async (status) => {
      await queryClient.cancelQueries({ queryKey: campaignKeys.all });
      const previousDetail = queryClient.getQueryData<Campaign>(campaignKeys.detail(id));
      const previousList = queryClient.getQueryData<InfiniteData<CampaignPage>>(campaignKeys.list());
      queryClient.setQueryData<Campaign | undefined>(campaignKeys.detail(id), (c) => setStatusOnCampaign(c, status));
      queryClient.setQueryData<InfiniteData<CampaignPage> | undefined>(campaignKeys.list(), (d) =>
        setStatusInPages(d, id, status),
      );
      return { previousDetail, previousList };
    },
    onError: (_error, _status, context) => {
      if (!context) return;
      queryClient.setQueryData(campaignKeys.detail(id), context.previousDetail);
      queryClient.setQueryData(campaignKeys.list(), context.previousList);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

/** What the detail screen needs to render the action button. */
export function useCampaignToggle(id: string, current: CampaignStatus | undefined) {
  const mutation = useToggleCampaignStatus(id);
  const target = current ? nextStatus(current) : null;
  return {
    canToggle: target !== null,
    isPending: mutation.isPending,
    error: mutation.isError ? 'Could not update the campaign. The change was reverted.' : null,
    toggle: () => {
      if (target) mutation.mutate(target);
    },
  };
}
