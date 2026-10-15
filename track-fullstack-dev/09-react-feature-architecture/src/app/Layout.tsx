import { Suspense } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { signOut } from '@/features/auth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/Skeleton';
import { useI18n, type Locale } from '@/i18n';
import { useSessionState } from '@/lib/session';

export function Layout({ protectedArea }: { protectedArea: boolean }) {
  const { t, locale, setLocale } = useI18n();
  const session = useSessionState();
  const navigate = useNavigate();
  const location = useLocation();

  // Session cleared mid-use (refresh failed): send the user to login, remembering where they were.
  if (protectedArea && !session) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  return (
    <>
      <a href="#main" className="skip">
        {t('app.skip')}
      </a>
      <header>
        <strong>{t('app.title')}</strong>
        <nav aria-label={t('nav.main')}>
          <Link to="/campaigns">{t('nav.campaigns')}</Link>
        </nav>
        <label>
          {t('lang.label')}{' '}
          <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
        {session ? (
          <button
            type="button"
            onClick={() => {
              signOut();
              void navigate('/login');
            }}
          >
            {t('nav.logout')}
          </button>
        ) : null}
      </header>
      <main id="main" tabIndex={-1}>
        <ErrorBoundary>
          <Suspense fallback={<Skeleton />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
