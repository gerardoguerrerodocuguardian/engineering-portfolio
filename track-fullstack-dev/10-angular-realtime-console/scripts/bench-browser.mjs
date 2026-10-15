// Browser benchmark against the production build served by the mock server (npm run build && npm run serve:dist).
// Measures: time to fill the 100k-row log at 20,000 ev/s, main-thread long tasks, frame pacing while scrolling, JS heap.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4310';
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const page = await browser.newPage();
await page.addInitScript(() => {
  window.__longTasks = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longTasks.push(e.duration))).observe({ type: 'longtask', buffered: true });
});
await fetch(`${BASE}/rate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"eps":200}' });
await page.goto(BASE);
await page.getByTestId('status').and(page.locator('[data-state="open"]')).waitFor();

await page.getByTestId('rate').selectOption('20000');
const t0 = Date.now();
await page.getByTestId('log-size').filter({ hasText: '100,000 / 100,000' }).waitFor({ timeout: 120_000 });
const fillMs = Date.now() - t0;

// Frame pacing for 5 s while the stream is still running at 20k ev/s and the user scrolls the log.
const frames = await page.evaluate(async () => {
  const vp = document.querySelector('cdk-virtual-scroll-viewport');
  const deltas = [];
  let last = performance.now();
  const end = last + 5000;
  await new Promise((resolve) => {
    const tick = (now) => {
      deltas.push(now - last);
      last = now;
      vp.scrollTop = (vp.scrollTop + 400) % (vp.scrollHeight - vp.clientHeight);
      now < end ? requestAnimationFrame(tick) : resolve();
    };
    requestAnimationFrame(tick);
  });
  deltas.shift();
  deltas.sort((a, b) => a - b);
  return { fps: Math.round((deltas.length / deltas.reduce((a, b) => a + b, 0)) * 1000), p95FrameMs: +deltas[Math.floor(deltas.length * 0.95)].toFixed(1), maxFrameMs: +deltas.at(-1).toFixed(1) };
});

const m = await page.evaluate(() => ({
  longTasks: window.__longTasks.length,
  longestTaskMs: Math.round(Math.max(0, ...window.__longTasks)),
  renderedRows: document.querySelectorAll('cdk-virtual-scroll-viewport .row').length,
  heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
}));
await fetch(`${BASE}/rate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"eps":50}' });
console.log(JSON.stringify({ fillMsTo100kRows: fillMs, ...frames, ...m }, null, 2));
await browser.close();
