import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

let shouldThrow = true;
const Bomb = () => { if (shouldThrow) throw new Error('boom'); return <p>healthy</p>; };
const fb = (e: Error, retry: () => void) => <div role="alert">failed: {e.message}<button onClick={retry}>retry</button></div>;

describe('ErrorBoundary', () => {
  it('renders the fallback, reports the error, and recovers on retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    shouldThrow = true;
    render(<ErrorBoundary fallback={fb} onError={onError}><Bomb /></ErrorBoundary>);
    expect(screen.getByRole('alert').textContent).toContain('failed: boom');
    expect(onError).toHaveBeenCalledOnce();
    shouldThrow = false;
    fireEvent.click(screen.getByText('retry'));
    expect(screen.getByText('healthy')).toBeTruthy();
  });
  it('resets when resetKey changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    shouldThrow = true;
    const { rerender } = render(<ErrorBoundary resetKey="a" fallback={fb}><Bomb /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeTruthy();
    shouldThrow = false;
    rerender(<ErrorBoundary resetKey="b" fallback={fb}><Bomb /></ErrorBoundary>);
    expect(screen.getByText('healthy')).toBeTruthy();
  });
});
