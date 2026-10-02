/**
 * postMessage protocol between the host page (embed.js) and the configurator iframe.
 * Every message is { source: 'sauna-configurator', v: 1, type, payload }.
 * Both sides check `event.origin` and `event.source` (D-038).
 */
export const SOURCE = 'sauna-configurator';
export const VERSION = 1;

export interface ToHost {
  ready: { tenant: string };
  resize: { height: number };
  step_change: { step: number; name: string };
  price_change: { mode: 'hidden' | 'range' | 'exact'; from?: number; to?: number; value?: number; currency: string };
  config_saved: { id: string; shareUrl: string };
  lead_submitted: { leadId: string; configId: string; value?: number; currency: string };
}

export interface ToFrame {
  /** Host page URL (share links point back to the manufacturer's page). */
  host: { href: string };
}

export type Message<M, K extends keyof M = keyof M> = { source: typeof SOURCE; v: typeof VERSION; type: K; payload: M[K] };

export function make<M, K extends keyof M>(type: K, payload: M[K]): Message<M, K> {
  return { source: SOURCE, v: VERSION, type, payload };
}

export function parse<M>(data: unknown): Message<M> | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<Message<M>>;
  return d.source === SOURCE && d.v === VERSION && typeof d.type === 'string' ? (d as Message<M>) : null;
}

/** Host-side events forwarded to analytics. */
export const ANALYTICS_EVENTS: ReadonlyArray<keyof ToHost> = ['step_change', 'price_change', 'lead_submitted', 'config_saved'];
