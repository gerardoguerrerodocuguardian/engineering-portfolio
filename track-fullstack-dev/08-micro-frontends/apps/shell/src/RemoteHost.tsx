import { Suspense } from 'react';
import type { RemoteEntry } from '@adflow/shared-contracts';
import { ErrorBoundary } from './ErrorBoundary';
import { forgetRemote, getRemoteComponent, RemoteLoadError } from './loaders';
import { useAuth } from './auth';

/** Failure isolation: a remote that is down, slow, skewed or crashing only blanks its own region. */
export function RemoteHost({ entry }: { entry: RemoteEntry }) {
  const { provider } = useAuth();
  const Remote = getRemoteComponent(entry);
  return (
    <ErrorBoundary
      resetKey={entry.id}
      onError={(e) => console.warn(`[shell] remote "${entry.id}" failed`, e)}
      fallback={(error, retry) => (
        <div role="alert" className="remote-fallback" data-testid="remote-fallback">
          <h2>{entry.title} is temporarily unavailable</h2>
          <p>The rest of AdFlow keeps working. {error instanceof RemoteLoadError ? `Reason: ${error.reason}.` : ''}</p>
          <p className="muted">{error.message}</p>
          <button onClick={() => { forgetRemote(entry); retry(); }}>Retry</button>
        </div>
      )}
    >
      <Suspense fallback={<p aria-busy="true">Loading {entry.title}...</p>}>
        <Remote tokenProvider={provider} />
      </Suspense>
    </ErrorBoundary>
  );
}
