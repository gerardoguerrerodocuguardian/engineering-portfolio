import type { Metadata } from 'next';
import { Suspense } from 'react';
import { fetchCampaigns } from '@/lib/campaigns/client';

// SSR: server-to-server call to the shared campaign contract; token never reaches the browser.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Advertisers', robots: { index: false } };

async function CampaignTable() {
  const { source, campaigns } = await fetchCampaigns();
  return (
    <>
      <p className="muted">
        Data source: {source === 'api' ? 'Campaign API (shared contract)' : 'synthetic fallback (set CAMPAIGN_API_URL to use the API)'}.
      </p>
      <table>
        <caption className="sr-only">Campaigns</caption>
        <thead>
          <tr><th scope="col">Name</th><th scope="col">Status</th><th scope="col">Daily budget</th><th scope="col">Max bid</th></tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <th scope="row">{c.name}</th>
              <td>{c.status}</td>
              <td>${(c.dailyBudgetCents / 100).toFixed(2)}</td>
              <td>${(c.maxBidCents / 100).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function AdvertiserPage() {
  return (
    <>
      <h1>Advertiser campaigns</h1>
      <Suspense fallback={<div className="skeleton" role="status" aria-label="Loading campaigns" />}>
        <CampaignTable />
      </Suspense>
    </>
  );
}
