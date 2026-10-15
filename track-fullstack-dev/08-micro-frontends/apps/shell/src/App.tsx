import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { getEventBus, type Manifest } from '@adflow/shared-contracts';
import { AuthProvider, useAuth } from './auth';
import { fetchManifest } from './manifest';
import { RemoteHost } from './RemoteHost';

function RemoteRoute({ manifest }: { manifest: Manifest }) {
  const { id } = useParams();
  const { signedIn } = useAuth();
  const entry = manifest.remotes.find((r) => r.id === id);
  if (!signedIn) return <p>Please sign in to open this area.</p>;
  if (!entry) return <p>Unknown area.</p>;
  return <RemoteHost entry={entry} />;
}

function Layout({ manifest }: { manifest: Manifest }) {
  const { signedIn, signIn, signOut, provider } = useAuth();
  const [selected, setSelected] = useState<string>(getEventBus().last('campaign:selected')?.name ?? 'none');
  useEffect(() => getEventBus().on('campaign:selected', (d) => setSelected(d.name)), []);
  return (
    <div className="layout">
      <header>
        <strong>AdFlow</strong>
        <nav aria-label="Main">
          {manifest.remotes.map((r) => <Link key={r.id} to={`/app/${r.id}`}>{r.title}</Link>)}
        </nav>
        <span className="spacer" />
        <span data-testid="selected">Selected campaign: {selected}</span>
        {signedIn
          ? <button onClick={signOut}>Sign out ({provider.getUser()?.name})</button>
          : <button onClick={signIn}>Sign in as demo advertiser</button>}
      </header>
      <main>
        <Routes>
          <Route path="/" element={<p>Welcome to the AdFlow shell. Sign in, then pick an area.</p>} />
          <Route path="/app/:id" element={<RemoteRoute manifest={manifest} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export function App({ manifestUrl = '/manifest.json' }: { manifestUrl?: string }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetchManifest(manifestUrl).then(setManifest, (e: Error) => setError(e.message)); }, [manifestUrl]);
  if (error) return <div role="alert" className="remote-fallback">Cannot load the deployment manifest: {error}</div>;
  if (!manifest) return <p aria-busy="true">Loading...</p>;
  return (
    <AuthProvider>
      <BrowserRouter><Layout manifest={manifest} /></BrowserRouter>
    </AuthProvider>
  );
}
