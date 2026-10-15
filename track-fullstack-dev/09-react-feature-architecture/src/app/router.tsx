import { createBrowserRouter, createMemoryRouter, Navigate, useRouteError, type RouteObject } from 'react-router';
import type { QueryClient } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth';
import { Skeleton } from '@/components/Skeleton';
import { useI18n } from '@/i18n';
import { Layout } from './Layout';

function RouteError() {
  const { t } = useI18n();
  const error = useRouteError();
  const notFound = typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
  return (
    <div role="alert" className="card">
      <h1>{notFound ? t('error.notFound') : t('error.title')}</h1>
    </div>
  );
}

type LoaderArgs = { request: Request; params: { id?: string } };

/**
 * The app layer COMPOSES features: it decides which route uses which feature
 * and wraps feature loaders with the auth guard, so features never import each other.
 * Every feature page is a dynamic import => one chunk per route.
 */
const guarded = (loader?: (args: LoaderArgs) => unknown) => async (args: LoaderArgs) => {
  await requireAuth(args.request);
  return loader ? loader(args) : null;
};

export function createRoutes(qc: QueryClient): RouteObject[] {
  return [
    {
      element: <Layout protectedArea={false} />,
      errorElement: <RouteError />,
      hydrateFallbackElement: <Skeleton />,
      children: [
        {
          path: '/login',
          lazy: async () => {
            const m = await import('@/features/auth/routes');
            return { Component: m.Component };
          },
        },
      ],
    },
    {
      element: <Layout protectedArea />,
      errorElement: <RouteError />,
      hydrateFallbackElement: <Skeleton />,
      children: [
        { path: '/', element: <Navigate to="/campaigns" replace /> },
        {
          path: '/campaigns',
          lazy: async () => {
            const m = await import('@/features/campaigns/routes');
            return { Component: m.Component, loader: guarded(m.loader(qc)) };
          },
        },
        {
          path: '/reports/:id',
          lazy: async () => {
            const m = await import('@/features/reports/routes');
            return { Component: m.Component, loader: guarded(m.loader(qc)) };
          },
        },
        { path: '*', loader: () => Promise.reject(new Response('Not found', { status: 404 })) },
      ],
    },
  ];
}

export const createAppRouter = (qc: QueryClient) => createBrowserRouter(createRoutes(qc));
export const createTestRouter = (qc: QueryClient, initialEntries: string[]) => createMemoryRouter(createRoutes(qc), { initialEntries });
