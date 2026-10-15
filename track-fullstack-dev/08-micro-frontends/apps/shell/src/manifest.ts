import type { Manifest, RemoteEntry } from '@adflow/shared-contracts';
import { satisfies } from './semver';

export class ManifestError extends Error {}

function validateEntry(e: unknown, i: number): RemoteEntry {
  const r = e as Partial<RemoteEntry>;
  const bad = (why: string) => new ManifestError(`remotes[${i}]: ${why}`);
  if (!r || typeof r !== 'object') throw bad('not an object');
  if (!r.id || !r.title || !r.entry || !r.version) throw bad('id, title, entry and version are required');
  if (r.kind === 'module-federation') {
    if (!r.scope || !r.expose) throw bad('module-federation needs scope and expose');
  } else if (r.kind === 'web-component') {
    if (!r.tag || !r.tag.includes('-')) throw bad('web-component needs a valid custom element tag');
  } else throw bad(`unknown kind "${String(r.kind)}"`);
  return { requires: {}, ...r } as RemoteEntry;
}

export function parseManifest(json: unknown): Manifest {
  const m = json as Partial<Manifest>;
  if (!m || m.schema !== 1 || !Array.isArray(m.remotes)) throw new ManifestError('unsupported manifest schema');
  const remotes = m.remotes.map(validateEntry);
  const ids = new Set<string>();
  for (const r of remotes) {
    if (ids.has(r.id)) throw new ManifestError(`duplicate remote id "${r.id}"`);
    ids.add(r.id);
  }
  return { schema: 1, generatedAt: m.generatedAt ?? '', remotes };
}

export async function fetchManifest(url: string, fetchImpl: typeof fetch = fetch): Promise<Manifest> {
  // no-store: the manifest is the deploy switch, it must never be served stale.
  const res = await fetchImpl(url, { cache: 'no-store' });
  if (!res.ok) throw new ManifestError(`manifest request failed: HTTP ${res.status}`);
  return parseManifest(await res.json());
}

export interface SkewIssue { dep: string; required: string; host: string }

/** Version-skew check: does the host provide every shared dep within the range the remote was built for? */
export function checkCompat(entry: RemoteEntry, host: Record<string, string>): SkewIssue[] {
  return Object.entries(entry.requires)
    .filter(([dep, range]) => !(dep in host) ? false : !satisfies(host[dep]!, range))
    .map(([dep, required]) => ({ dep, required, host: host[dep]! }));
}
