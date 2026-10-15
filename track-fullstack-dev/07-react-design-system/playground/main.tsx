import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Badge, Button, Dialog, Select, Skeleton, Table, Tabs, TextField, ToastProvider, Tooltip, useTableSort, useToast,
} from '../src';
import '../src/styles/tokens.css';
import '../src/styles/components.css';

const campaigns = [
  { name: 'Spring launch', spend: 300, status: 'Delivering' },
  { name: 'Autumn promo', spend: 120, status: 'Paused' },
  { name: 'Brand video', spend: 900, status: 'Rejected' },
];
const accessors = { name: (r: (typeof campaigns)[number]) => r.name, spend: (r: (typeof campaigns)[number]) => r.spend };

function Demo() {
  const [theme, setTheme] = useState('light');
  const { toast } = useToast();
  const { rows, toggle, directionOf } = useTableSort(campaigns, accessors);
  document.documentElement.dataset.theme = theme;

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24, display: 'grid', gap: 24, background: 'var(--adf-color-bg)', color: 'var(--adf-color-fg)', fontFamily: 'var(--adf-font-family)' }}>
      <h1>AdFlow design system</h1>
      <Select label="Theme" value={theme} onValueChange={setTheme} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'high-contrast', label: 'High contrast' }]} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={() => toast({ title: 'Saved', description: 'Campaign updated', tone: 'success' })}>Show toast</Button>
        <Tooltip content="Secondary action"><Button variant="secondary">Hover or focus me</Button></Tooltip>
        <Dialog>
          <Dialog.Trigger>Open dialog</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Pause campaign?</Dialog.Title>
            <Dialog.Description>Spend stops immediately.</Dialog.Description>
            <Dialog.Close>Cancel</Dialog.Close> <Dialog.Close>Pause</Dialog.Close>
          </Dialog.Content>
        </Dialog>
      </div>
      <TextField label="Campaign name" description="Visible to your team" />
      <Tabs defaultValue="table">
        <Tabs.List aria-label="Sections">
          <Tabs.Trigger value="table">Campaigns</Tabs.Trigger>
          <Tabs.Trigger value="loading">Loading state</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="table">
          <Table>
            <Table.Caption>Campaign spend (synthetic)</Table.Caption>
            <Table.Header>
              <Table.Row>
                <Table.Head sortDirection={directionOf('name')} onSort={() => toggle('name')}>Name</Table.Head>
                <Table.Head sortDirection={directionOf('spend')} onSort={() => toggle('spend')}>Spend</Table.Head>
                <Table.Head>Status</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((r) => (
                <Table.Row key={r.name}>
                  <Table.Cell>{r.name}</Table.Cell>
                  <Table.Cell>{r.spend}</Table.Cell>
                  <Table.Cell><Badge tone={r.status === 'Delivering' ? 'success' : r.status === 'Paused' ? 'warning' : 'danger'}>{r.status}</Badge></Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Tabs.Content>
        <Tabs.Content value="loading">
          <div aria-busy="true"><Skeleton width="60%" /><br /><Skeleton width="40%" /></div>
        </Tabs.Content>
      </Tabs>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <Demo />
    </ToastProvider>
  </StrictMode>,
);
