import { Suspense } from 'react';
import { QueryErrorResetBoundary, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/Skeleton';
import { usd } from '@/components/format';
import { useI18n } from '@/i18n';
import { reportQuery } from './api';

function Metrics({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const { data } = useSuspenseQuery(reportQuery(id));
  const nf = new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US');
  return (
    <dl className="metrics">
      <div>
        <dt>{t('reports.impressions')}</dt>
        <dd>{nf.format(data.impressions)}</dd>
      </div>
      <div>
        <dt>{t('reports.clicks')}</dt>
        <dd>{nf.format(data.clicks)}</dd>
      </div>
      <div>
        <dt>{t('reports.spend')}</dt>
        <dd>{usd(data.spendCents, locale === 'es' ? 'es-MX' : 'en-US')}</dd>
      </div>
      <div>
        <dt>{t('reports.ctr')}</dt>
        <dd>{(data.ctr * 100).toFixed(2)}%</dd>
      </div>
    </dl>
  );
}

export function ReportPage() {
  const { t } = useI18n();
  const { id = '' } = useParams();
  return (
    <section aria-labelledby="report-title">
      <h1 id="report-title">{t('reports.title', { id })}</h1>
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary onReset={reset}>
            <Suspense fallback={<Skeleton rows={2} />}>
              <Metrics id={id} />
            </Suspense>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
      <Link to="/campaigns">{t('reports.back')}</Link>
    </section>
  );
}
