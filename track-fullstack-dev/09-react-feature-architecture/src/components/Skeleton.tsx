import { useI18n } from '@/i18n';

/** Fixed-height placeholder: reserves space so content does not shift (CLS) when data arrives. */
export function Skeleton({ rows = 5 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-busy="true" aria-label={t('app.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" aria-hidden="true" />
      ))}
    </div>
  );
}
