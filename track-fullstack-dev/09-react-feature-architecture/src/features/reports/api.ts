import { queryOptions } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';

export const reportQuery = (id: string) =>
  queryOptions({
    queryKey: ['reports', id] as const,
    queryFn: async ({ signal }) => unwrap(await api.GET('/v1/campaigns/{id}/report', { params: { path: { id } }, signal })),
  });
