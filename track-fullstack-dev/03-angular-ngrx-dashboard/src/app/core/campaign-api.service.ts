import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { Campaign, CampaignPage, CampaignReport, CampaignStatus, CreateCampaign, UpdateCampaign } from './models';

@Injectable({ providedIn: 'root' })
export class CampaignApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/v1/campaigns`;

  list(page: number, pageSize: number, status: CampaignStatus | null): Observable<CampaignPage> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (status) params = params.set('status', status);
    return this.http.get<CampaignPage>(this.base, { params });
  }

  get(id: string): Observable<Campaign> {
    return this.http.get<Campaign>(`${this.base}/${encodeURIComponent(id)}`);
  }

  create(body: CreateCampaign): Observable<Campaign> {
    return this.http.post<Campaign>(this.base, body);
  }

  update(id: string, body: UpdateCampaign): Observable<Campaign> {
    return this.http.patch<Campaign>(`${this.base}/${encodeURIComponent(id)}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${encodeURIComponent(id)}`);
  }

  report(id: string): Observable<CampaignReport> {
    return this.http.get<CampaignReport>(`${this.base}/${encodeURIComponent(id)}/report`);
  }
}
