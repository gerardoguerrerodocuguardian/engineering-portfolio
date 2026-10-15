import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from '@/mocks/server';
import { resetDb } from '@/mocks/db';
import { resetAuth } from '@/mocks/handlers';
import { clearSession } from '@/lib/session';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
  resetAuth();
  if (typeof sessionStorage !== 'undefined') clearSession();
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
afterAll(() => server.close());
