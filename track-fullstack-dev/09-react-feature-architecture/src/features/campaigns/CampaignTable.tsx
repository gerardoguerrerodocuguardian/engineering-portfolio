import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useAnnounce } from '@/components/LiveRegion';
import { usd } from '@/components/format';
import { useI18n } from '@/i18n';
import { campaignListQuery, useSetCampaignStatus, type ListParams } from './api';

export function CampaignTable({ params, onPage }: { params: ListParams; onPage: (page: number) => void }) {
  const { t, locale } = useI18n();
  const announce = useAnnounce();
  const { data } = useSuspenseQuery(campaignListQuery(params));
  const setStatus = useSetCampaignStatus();
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  if (data.items.length === 0) return <p>{t('campaigns.empty')}</p>;

  return (
    <>
      <table>
        <caption className="sr-only">{t('campaigns.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('campaigns.col.name')}</th>
            <th scope="col">{t('campaigns.col.status')}</th>
            <th scope="col">{t('campaigns.col.budget')}</th>
            <th scope="col">{t('campaigns.col.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((c) => {
            const next = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
            const canToggle = c.status === 'ACTIVE' || c.status === 'PAUSED';
            return (
              <tr key={c.id}>
                <th scope="row">{c.name}</th>
                <td data-testid={`status-${c.id}`}>{t(`status.${c.status}`)}</td>
                <td>{usd(c.dailyBudgetCents, locale === 'es' ? 'es-MX' : 'en-US')}</td>
                <td className="actions">
                  {canToggle ? (
                    <button
                      type="button"
                      onClick={() =>
                        setStatus.mutate(
                          { id: c.id, status: next },
                          {
                            onSuccess: () => announce(t('campaigns.updated')),
                            onError: () => announce(t('campaigns.updateFailed')),
                          },
                        )
                      }
                    >
                      {c.status === 'ACTIVE' ? t('campaigns.pause') : t('campaigns.activate')}{' '}
                      <span className="sr-only">{c.name}</span>
                    </button>
                  ) : null}
                  <Link to={`/reports/${c.id}`}>
                    {t('campaigns.report')}{' '}
                    <span className="sr-only">{c.name}</span>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <nav aria-label={t('campaigns.page', { page: data.page, pages })} className="pager">
        <button type="button" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
          {t('campaigns.prev')}
        </button>
        <span>{t('campaigns.page', { page: data.page, pages })}</span>
        <button type="button" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>
          {t('campaigns.next')}
        </button>
      </nav>
    </>
  );
}
