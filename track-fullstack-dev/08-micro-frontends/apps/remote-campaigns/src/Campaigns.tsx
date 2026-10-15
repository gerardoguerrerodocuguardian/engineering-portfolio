import { useEffect, useState } from 'react';
import { getEventBus, type RemoteProps } from '@adflow/shared-contracts';
import '@adflow/shared-ui-tokens/tokens.css';

const DATA = [
  { id: 'c-100', name: 'Spring Launch', status: 'ACTIVE' as const },
  { id: 'c-101', name: 'Back to School', status: 'PAUSED' as const },
  { id: 'c-102', name: 'Winter Clearance', status: 'ENDED' as const },
];

export default function Campaigns({ tokenProvider }: RemoteProps) {
  const [items, setItems] = useState(DATA);
  const [user, setUser] = useState<string>('...');
  useEffect(() => {
    // The remote asks the shell-provided interface; it never reads storage or shell internals.
    tokenProvider.getToken().then((t) => setUser(t ? (tokenProvider.getUser()?.name ?? 'unknown') : 'anonymous'));
  }, [tokenProvider]);
  const bus = getEventBus();
  return (
    <section aria-labelledby="camp-h" style={{ fontFamily: 'var(--adflow-font)' }}>
      <h2 id="camp-h">Campaigns</h2>
      <p style={{ color: 'var(--adflow-color-muted)' }}>Signed in as <span data-testid="campaigns-user">{user}</span></p>
      <ul>
        {items.map((c) => (
          <li key={c.id}>
            {c.name} - {c.status}{' '}
            <button onClick={() => bus.emit('campaign:selected', { campaignId: c.id, name: c.name })}>Select {c.name}</button>{' '}
            <button onClick={() => {
              const status = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
              setItems((l) => l.map((x) => (x.id === c.id ? { ...x, status } : x)));
              bus.emit('campaign:status-changed', { campaignId: c.id, status });
            }}>Toggle</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
