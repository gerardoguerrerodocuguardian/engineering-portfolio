import { Suspense } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/Skeleton';
import { useI18n } from '@/i18n';
import type { CampaignStatus, ListParams } from './api';
import { CampaignTable } from './CampaignTable';
import { CreateCampaignForm } from './CreateCampaignForm';

const STATUSES: CampaignStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'EXHAUSTED'];

export function paramsFromUrl(search: URLSearchParams): ListParams {
  const status = search.get('status');
  const page = Number(search.get('page') ?? 1);
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    status: STATUSES.includes(status as CampaignStatus) ? (status as CampaignStatus) : undefined,
  };
}

export function CampaignsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useSearchParams();
  const params = paramsFromUrl(search);

  const update = (next: Partial<ListParams>) => {
    const merged = { ...params, ...next };
    const q = new URLSearchParams();
    if (merged.status) q.set('status', merged.status);
    if (merged.page > 1) q.set('page', String(merged.page));
    setSearch(q);
  };

  return (
    <section aria-labelledby="campaigns-title">
      <h1 id="campaigns-title">{t('campaigns.title')}</h1>
      <div className="toolbar">
        <label>
          {t('campaigns.filter')}{' '}
          <select value={params.status ?? ''} onChange={(e) => update({ status: (e.target.value || undefined) as CampaignStatus | undefined, page: 1 })}>
            <option value="">{t('campaigns.filter.all')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary onReset={reset}>
            <Suspense fallback={<Skeleton rows={5} />}>
              <CampaignTable params={params} onPage={(page) => update({ page })} />
            </Suspense>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
      <CreateCampaignForm />
    </section>
  );
}
