import { config } from './config';

export interface Campaign {
  id: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXHAUSTED';
  dailyBudgetCents: number;
  maxBidCents: number;
  keywords?: string[];
  createdAt: string;
}
export interface CampaignPage {
  items: Campaign[];
  page: number;
  pageSize: number;
  total: number;
}
export interface CampaignReport {
  campaignId: string;
  impressions: number;
  clicks: number;
  spendCents: number;
  ctr: number;
}
export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface ApiResponse<T = any> {
  status: number;
  contentType: string;
  body: T;
  method: string;
  path: string;
}

/** Thin typed HTTP client over fetch. Never throws on non-2xx: tests assert on the response. */
export class ApiClient {
  constructor(private readonly baseUrl: string = config.baseUrl) {}

  private async call<T>(
    method: string,
    path: string,
    token?: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return {
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      body: (text ? JSON.parse(text) : undefined) as T,
      method,
      path: path.split('?')[0],
    };
  }

  login(username: string, password: string) {
    return this.call<TokenPair>('POST', '/auth/token', undefined, { username, password });
  }
  refresh(refreshToken: string) {
    return this.call<TokenPair>('POST', '/auth/refresh', undefined, { refreshToken });
  }
  listCampaigns(token?: string, query: Record<string, string | number> = {}) {
    const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
    return this.call<CampaignPage>('GET', `/v1/campaigns${qs ? `?${qs}` : ''}`, token);
  }
  createCampaign(token: string | undefined, payload: unknown) {
    return this.call<Campaign>('POST', '/v1/campaigns', token, payload);
  }
  getCampaign(token: string | undefined, id: string) {
    return this.call<Campaign>('GET', `/v1/campaigns/${id}`, token);
  }
  updateCampaign(token: string | undefined, id: string, payload: unknown) {
    return this.call<Campaign>('PATCH', `/v1/campaigns/${id}`, token, payload);
  }
  deleteCampaign(token: string | undefined, id: string) {
    return this.call<void>('DELETE', `/v1/campaigns/${id}`, token);
  }
  getReport(token: string | undefined, id: string) {
    return this.call<CampaignReport>('GET', `/v1/campaigns/${id}/report`, token);
  }
}
