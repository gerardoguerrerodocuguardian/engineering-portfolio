import { describe, expect, it, vi } from 'vitest';
import { checkCompat, fetchManifest, ManifestError, parseManifest } from './manifest';

const mf = { id: 'a', title: 'A', kind: 'module-federation', entry: 'http://x/remoteEntry.js', version: '1.0.0', scope: 'a', expose: './A', requires: { react: '^18.3.1' } };
const wc = { id: 'b', title: 'B', kind: 'web-component', entry: 'http://x/b.js', version: '1.0.0', tag: 'adflow-b' };
const doc = { schema: 1, generatedAt: 'now', remotes: [mf, wc] };

describe('parseManifest', () => {
  it('accepts a valid manifest and defaults requires', () => {
    const m = parseManifest(doc);
    expect(m.remotes).toHaveLength(2);
    expect(m.remotes[1]!.requires).toEqual({});
  });
  it('rejects wrong schema, duplicates, bad kinds and missing fields', () => {
    expect(() => parseManifest({ schema: 2, remotes: [] })).toThrow(ManifestError);
    expect(() => parseManifest({ ...doc, remotes: [mf, mf] })).toThrow(/duplicate/);
    expect(() => parseManifest({ ...doc, remotes: [{ ...mf, kind: 'iframe' }] })).toThrow(/unknown kind/);
    expect(() => parseManifest({ ...doc, remotes: [{ ...wc, tag: 'nodash' }] })).toThrow(/tag/);
    expect(() => parseManifest({ ...doc, remotes: [{ ...mf, scope: undefined }] })).toThrow(/scope/);
  });
});

describe('fetchManifest', () => {
  it('fetches with no-store and parses', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => doc });
    const m = await fetchManifest('/manifest.json', f as never);
    expect(f).toHaveBeenCalledWith('/manifest.json', { cache: 'no-store' });
    expect(m.remotes[0]!.id).toBe('a');
  });
  it('throws on HTTP errors', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchManifest('/m', f as never)).rejects.toThrow(/503/);
  });
});

describe('checkCompat (version skew)', () => {
  it('reports no issue when the host satisfies the range', () => {
    expect(checkCompat(parseManifest(doc).remotes[0]!, { react: '18.3.1' })).toEqual([]);
  });
  it('reports skew when the host major differs', () => {
    expect(checkCompat(parseManifest(doc).remotes[0]!, { react: '19.0.0' })).toEqual([{ dep: 'react', required: '^18.3.1', host: '19.0.0' }]);
  });
});
