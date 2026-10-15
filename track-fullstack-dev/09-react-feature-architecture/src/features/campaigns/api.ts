import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import type { components } from '@/api/schema';

export type Campaign = components['schemas']['Campaign'];
export type CampaignStatus = components['schemas']['CampaignStatus'];
export interface ListParams {
  page: number;
  status?: CampaignStatus;
}
export const PAGE_SIZE = 5;

export const campaignKeys = {
  all: ['campaigns'] as const,
  list: (p: ListParams) => ['campaigns', 'list', p] as const,
};

export const campaignListQuery = (params: ListParams) =>
  queryOptions({
    queryKey: campaignKeys.list(params),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/campaigns', { params: { query: { page: params.page, pageSize: PAGE_SIZE, status: params.status } }, signal })),
  });

type ListData = Awaited<ReturnType<NonNullable<ReturnType<typeof campaignListQuery>['queryFn']>>>;

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: components['schemas']['CreateCampaign']) => unwrap(await api.POST('/v1/campaigns', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

/**
 * Optimistic status change with rollback:
 *  1. cancel in-flight list fetches (they would overwrite the optimistic value),
 *  2. snapshot every cached list, 3. patch them, 4. restore snapshots on error,
 *  5. always refetch on settle so the cache converges to server truth.
 */
export function useSetCampaignStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CampaignStatus }) =>
      unwrap(await api.PATCH('/v1/campaigns/{id}', { params: { path: { id } }, body: { status } })),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: campaignKeys.all });
      const snapshots = qc.getQueriesData<ListData>({ queryKey: campaignKeys.all });
      qc.setQueriesData<ListData>({ queryKey: campaignKeys.all }, (old) =>
        old ? { ...old, items: old.items.map((c) => (c.id === id ? { ...c, status } : c)) } : old,
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}
