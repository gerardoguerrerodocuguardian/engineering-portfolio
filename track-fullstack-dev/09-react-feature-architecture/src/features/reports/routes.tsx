import type { QueryClient } from '@tanstack/react-query';
import { reportQuery } from './api';

export { ReportPage as Component } from './ReportPage';

export const loader = (qc: QueryClient) => async ({ params }: { params: { id?: string } }) => {
  if (params.id) void qc.prefetchQuery(reportQuery(params.id));
  return null;
};
