/**
 * Typed, framework-agnostic event bus on top of DOM CustomEvents.
 * Micro-frontends talk through `window`, so they share no module instances (no singleton needed)
 * and a remote built with any framework can participate.
 *
 * Add new events ONLY here and treat the payloads as a public API (additive changes only).
 */
export interface AdflowEvents {
  'campaign:selected': { campaignId: string; name: string };
  'campaign:status-changed': { campaignId: string; status: 'ACTIVE' | 'PAUSED' | 'ENDED' };
  'auth:signed-out': Record<string, never>;
}
export type EventName = keyof AdflowEvents;

const PREFIX = 'adflow:';

export interface EventBus {
  emit<K extends EventName>(name: K, detail: AdflowEvents[K]): void;
  /** Subscribe; returns an unsubscribe function. */
  on<K extends EventName>(name: K, handler: (detail: AdflowEvents[K]) => void): () => void;
  /** Last payload emitted for the event (late subscribers, e.g. a lazily loaded remote, can catch up). */
  last<K extends EventName>(name: K): AdflowEvents[K] | undefined;
}

export function createEventBus(target: EventTarget = window): EventBus {
  const lastValues = new Map<string, unknown>();
  return {
    emit(name, detail) {
      lastValues.set(name, detail);
      target.dispatchEvent(new CustomEvent(PREFIX + name, { detail }));
    },
    on(name, handler) {
      const listener = (e: Event) => handler((e as CustomEvent).detail);
      target.addEventListener(PREFIX + name, listener);
      return () => target.removeEventListener(PREFIX + name, listener);
    },
    last(name) {
      return lastValues.get(name) as never;
    },
  };
}

/**
 * Every MFE bundle gets its own copy of this module, so the "last value" cache must live on a shared
 * object too. We keep one bus per target on a well-known global key.
 */
const KEY = '__adflowEventBus__';
export function getEventBus(target: EventTarget = window): EventBus {
  const holder = target as unknown as Record<string, EventBus | undefined>;
  return (holder[KEY] ??= createEventBus(target));
}
