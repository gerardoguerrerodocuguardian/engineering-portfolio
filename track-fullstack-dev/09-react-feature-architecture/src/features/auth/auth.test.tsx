import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp, signedIn } from '@/test/render';
import { getSession } from '@/lib/session';

describe('auth', () => {
  it('redirects anonymous users to /login and returns them after signing in', async () => {
    const { router } = renderApp('/reports/cmp-001');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.search).toContain('redirect=%2Freports%2Fcmp-001');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'ada@adflow.test');
    await user.type(screen.getByLabelText('Password'), 'adflow-demo');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Report for cmp-001' })).toBeInTheDocument();
    expect(getSession()?.user.name).toBe('Ada Example');
  });

  it('validates the form with zod messages and shows a server failure accessibly', async () => {
    renderApp('/login');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Email'), 'ada@adflow.test');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Wrong email or password.')).toBeInTheDocument();
  });

  it('restores the session from the refresh token after a reload', async () => {
    // reload: only the refresh token survives (sessionStorage); the in-memory access token is gone
    sessionStorage.setItem('adflow.refresh', 'refresh-1');
    expect(getSession()).toBeNull();
    renderApp('/campaigns');
    expect(await screen.findByRole('heading', { name: 'Campaigns' })).toBeInTheDocument();
  });

  it('signs out', async () => {
    signedIn();
    renderApp('/campaigns');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument());
    expect(getSession()).toBeNull();
  });
});
