import type { SaunaConfig } from '@sauna/core';

/**
 * Persistence. M3 ships a local implementation (localStorage, same browser only);
 * M4 switches to the HTTP one (server recomputes via core and is authoritative).
 */
export interface SavedConfig {
  id: string;
  revision: number;
  config: SaunaConfig;
}

export interface Contact {
  name: string;
  email: string;
  phone: string;
  postalCode: string;
  term: string;
  budget: string;
  note: string;
  consent: boolean;
}

export interface LeadInput {
  tenant: string;
  config: SaunaConfig;
  contact: Contact;
  photo?: File;
  locale: string;
  /** Client-side summary for analytics only; the server recomputes everything. */
  clientPrice: number;
  /** PNG renders for the offer PDF (view → data URL). */
  snapshots?: Array<{ view: string; dataUrl: string }>;
}

export interface Repos {
  saveConfig(config: SaunaConfig): Promise<SavedConfig>;
  loadConfig(id: string): Promise<SaunaConfig | null>;
  submitLead(lead: LeadInput): Promise<{ leadId: string; configId: string }>;
}

const rid = (p: string) => `${p}${Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12)}`;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked third-party storage → saving still works for this session
  }
}

export function localRepos(): Repos {
  const mem = new Map<string, string>();
  const get = (k: string) => storage()?.getItem(k) ?? mem.get(k) ?? null;
  const set = (k: string, v: string) => {
    mem.set(k, v);
    try {
      storage()?.setItem(k, v);
    } catch {
      /* quota / blocked */
    }
  };
  const save = async (config: SaunaConfig): Promise<SavedConfig> => {
    const id = config.id && config.id !== 'new' ? config.id : rid('c');
    const prev = get(`sauna:cfg:${id}`);
    const revision = (prev ? (JSON.parse(prev) as SaunaConfig).revision : 0) + 1;
    const saved = { ...config, id, revision };
    set(`sauna:cfg:${id}`, JSON.stringify(saved));
    return { id, revision, config: saved };
  };
  return {
    saveConfig: save,
    async loadConfig(id) {
      const s = get(`sauna:cfg:${id}`);
      return s ? (JSON.parse(s) as SaunaConfig) : null;
    },
    async submitLead(lead) {
      const saved = await save(lead.config);
      const leadId = rid('l');
      set(`sauna:lead:${leadId}`, JSON.stringify({ ...lead, photo: lead.photo ? { name: lead.photo.name, size: lead.photo.size } : null, configId: saved.id, at: new Date().toISOString() }));
      return { leadId, configId: saved.id };
    },
  };
}

/** M4: REST API (POST/PUT /configs, GET /configs/:id, POST /leads). The tenant is always explicit. */
export function httpRepos(apiBase: string, tenant: string): Repos {
  const json = async (r: Response) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };
  const q = `tenant=${encodeURIComponent(tenant)}`;
  return {
    async saveConfig(config) {
      const isNew = !config.id || config.id === 'new';
      const r = await fetch(`${apiBase}/configs${isNew ? '' : `/${encodeURIComponent(config.id)}?${q}`}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
        credentials: 'omit',
      });
      const e = (await json(r)) as { id: string; revision: number; config: SaunaConfig };
      return { id: e.id, revision: e.revision, config: e.config };
    },
    async loadConfig(id) {
      const r = await fetch(`${apiBase}/configs/${encodeURIComponent(id)}?${q}`, { credentials: 'omit' });
      return r.status === 404 ? null : ((await json(r)) as { config: SaunaConfig }).config;
    },
    async submitLead(lead) {
      const fd = new FormData();
      const { photo, snapshots, ...rest } = lead;
      fd.set('payload', JSON.stringify({ ...rest, contact: lead.contact }));
      if (photo) fd.set('photo', photo);
      for (const s of snapshots ?? []) fd.set(`snapshot_${s.view}`, await (await fetch(s.dataUrl)).blob(), `${s.view}.png`);
      return (await json(await fetch(`${apiBase}/leads`, { method: 'POST', body: fd, credentials: 'omit' }))) as { leadId: string; configId: string };
    },
  };
}
