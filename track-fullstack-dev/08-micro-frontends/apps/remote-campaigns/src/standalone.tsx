import { createRoot } from 'react-dom/client';
import { staticTokenProvider } from '@adflow/shared-contracts';
import Campaigns from './Campaigns';

// Independent dev: run this remote alone with a fake session; no shell needed.
createRoot(document.getElementById('root')!).render(
  <Campaigns tokenProvider={staticTokenProvider('dev-token', { id: 'dev', name: 'Standalone Dev' })} />,
);
