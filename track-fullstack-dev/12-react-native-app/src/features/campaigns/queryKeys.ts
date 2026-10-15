export const campaignKeys = {
  all: ['campaigns'] as const,
  list: () => ['campaigns', 'list'] as const,
  detail: (id: string) => ['campaigns', 'detail', id] as const,
  report: (id: string) => ['campaigns', 'report', id] as const,
};
