import type { Campaign, CampaignPage, CampaignReport, CampaignStatus, Problem, UpdateCampaign } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem?: Problem,
  ) {
    super(problem?.title ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl?: FetchLike;
  getToken: () => Promise<string | null>;
  /** Called on 401 so the app can drop the session. */
  onUnauthorized?: () => void;
}

export interface ListCampaignsParams {
  page?: number;
  pageSize?: number;
  status?: CampaignStatus;
}

export interface ApiClient {
  listCampaigns(params?: ListCampaignsParams): Promise<CampaignPage>;
  getCampaign(id: string): Promise<Campaign>;
  updateCampaign(id: string, patch: UpdateCampaign): Promise<Campaign>;
  getCampaignReport(id: string): Promise<CampaignReport>;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await options.getToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (init.body) headers['Content-Type'] = 'application/json';

    const response = await doFetch(`${options.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      if (response.status === 401) options.onUnauthorized?.();
      let problem: Problem | undefined;
      try {
        problem = (await response.json()) as Problem;
      } catch {
        problem = undefined;
      }
      throw new ApiError(response.status, problem);
    }
    return (await response.json()) as T;
  }

  return {
    listCampaigns({ page = 1, pageSize = 20, status } = {}) {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (status) query.set('status', status);
      return request<CampaignPage>(`/v1/campaigns?${query.toString()}`);
    },
    getCampaign: (id) => request<Campaign>(`/v1/campaigns/${encodeURIComponent(id)}`),
    updateCampaign: (id, patch) =>
      request<Campaign>(`/v1/campaigns/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    getCampaignReport: (id) => request<CampaignReport>(`/v1/campaigns/${encodeURIComponent(id)}/report`),
  };
}
