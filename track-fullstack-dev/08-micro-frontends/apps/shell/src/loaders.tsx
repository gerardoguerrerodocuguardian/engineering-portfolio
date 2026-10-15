import { createElement, lazy, useEffect, useRef, version as reactVersion, type ComponentType } from 'react';
import { version as reactDomVersion } from 'react-dom';
import { loadRemote, registerRemotes } from '@module-federation/runtime';
import type { RemoteEntry, RemoteProps } from '@adflow/shared-contracts';
import { checkCompat } from './manifest';

export const HOST_VERSIONS: Record<string, string> = { react: reactVersion, 'react-dom': reactDomVersion };
export const LOAD_TIMEOUT_MS = 8000;

export class RemoteLoadError extends Error {
  constructor(public readonly remoteId: string, public readonly reason: 'timeout' | 'skew' | 'network' | 'contract', message: string) {
    super(message);
  }
}

const withTimeout = <T,>(p: Promise<T>, id: string, ms = LOAD_TIMEOUT_MS) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new RemoteLoadError(id, 'timeout', `${id} did not load within ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

type Loaded = { default: ComponentType<RemoteProps> };

async function loadModuleFederation(entry: RemoteEntry): Promise<Loaded> {
  // Runtime registration: the URL comes from the deployment manifest, not from the shell build.
  registerRemotes([{ name: entry.scope!, entry: entry.entry, type: 'module' }], { force: true });
  const mod = await loadRemote<Loaded>(`${entry.scope}/${entry.expose!.replace(/^\.\//, '')}`);
  if (!mod?.default) throw new RemoteLoadError(entry.id, 'contract', `${entry.id} exposes no default component`);
  return mod;
}

function WebComponentHost({ tag, tokenProvider }: RemoteProps & { tag: string }) {
  const ref = useRef<HTMLElement & { tokenProvider?: unknown }>(null);
  useEffect(() => { if (ref.current) ref.current.tokenProvider = tokenProvider; }, [tokenProvider]);
  return createElement(tag, { ref });
}

async function loadWebComponent(entry: RemoteEntry): Promise<Loaded> {
  await import(/* @vite-ignore */ entry.entry);
  if (!customElements.get(entry.tag!)) throw new RemoteLoadError(entry.id, 'contract', `<${entry.tag}> was not defined by ${entry.entry}`);
  return { default: (props) => <WebComponentHost {...props} tag={entry.tag!} /> };
}

async function load(entry: RemoteEntry): Promise<Loaded> {
  const issues = checkCompat(entry, HOST_VERSIONS);
  if (issues.length) {
    // Fail fast and legibly instead of running two Reacts and crashing with an obscure hooks error.
    throw new RemoteLoadError(entry.id, 'skew', issues.map((i) => `${i.dep}: remote needs ${i.required}, shell has ${i.host}`).join('; '));
  }
  try {
    return await withTimeout(entry.kind === 'web-component' ? loadWebComponent(entry) : loadModuleFederation(entry), entry.id);
  } catch (e) {
    if (e instanceof RemoteLoadError) throw e;
    throw new RemoteLoadError(entry.id, 'network', `${entry.id} failed to load: ${(e as Error).message}`);
  }
}

const cache = new Map<string, ReturnType<typeof lazy<ComponentType<RemoteProps>>>>();
const keyOf = (e: RemoteEntry) => `${e.id}@${e.version}@${e.entry}`;

/** Lazy component for a manifest entry; cached per id+version+url so a new deploy gets a fresh load. */
export function getRemoteComponent(entry: RemoteEntry) {
  const k = keyOf(entry);
  if (!cache.has(k)) cache.set(k, lazy(() => load(entry)));
  return cache.get(k)!;
}
export const forgetRemote = (entry: RemoteEntry) => cache.delete(keyOf(entry));
