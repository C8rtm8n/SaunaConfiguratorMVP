import { useState } from 'preact/hooks';
import type { Catalog, CatalogIssue } from '@sauna/core';
import { ApiError, api } from '../api.js';

interface Result {
  version?: string;
  dryRun?: boolean;
  issues: CatalogIssue[];
  diff: { lists: Record<string, { added: string[]; removed: string[]; changed: string[] }>; settings: string[] };
}

/** Dry run (validation + diff) → publish as a new immutable catalog version (D-049). */
export function Publish(p: { draft: Catalog; dirty: boolean; onPublished: (version: string) => void; readOnly: boolean }) {
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (p.readOnly) return <p class="muted small">Role „sales“ má katalog jen pro čtení.</p>;
  const call = async (dryRun: boolean) => {
    setBusy(true);
    setMsg('');
    try {
      const r = await api<Result>('/admin/catalog', { method: 'POST', json: { catalog: p.draft, dryRun } });
      setRes(r);
      if (!dryRun && r.version) {
        setMsg(`Publikována verze ${r.version}. Nové konfigurace ji používají, uložené revize zůstávají na své verzi.`);
        p.onPublished(r.version);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setRes(e.body as Result);
      else setMsg('Uložení se nezdařilo.');
    } finally {
      setBusy(false);
    }
  };
  const errors = res?.issues.filter((i) => i.level === 'error') ?? [];
  const warnings = res?.issues.filter((i) => i.level === 'warning') ?? [];
  const changes = res ? Object.entries(res.diff.lists) : [];
  return (
    <div class="publish">
      <div class="row">
        <button type="button" class="btn" disabled={!p.dirty || busy} onClick={() => call(true)}>
          Zkontrolovat změny
        </button>
        <button type="button" class="btn primary" disabled={!p.dirty || busy || !res?.dryRun || errors.length > 0} onClick={() => call(false)}>
          Publikovat novou verzi
        </button>
        {msg && <span class="ok">{msg}</span>}
      </div>
      {res && (
        <div class="card" data-testid="publish-result">
          {errors.length > 0 && (
            <>
              <h4 class="err">Chyby ({errors.length}) – nelze publikovat</h4>
              <ul>{errors.map((i, k) => <li key={k} class="err">{i.path}: {i.message}</li>)}</ul>
            </>
          )}
          <h4>Změny</h4>
          {changes.length === 0 && res.diff.settings.length === 0 ? (
            <p class="muted">Žádné změny.</p>
          ) : (
            <ul>
              {changes.map(([list, d]) => (
                <li key={list}>
                  <b>{list}</b>: {d.added.length > 0 && `+ ${d.added.join(', ')} `}
                  {d.removed.length > 0 && `− ${d.removed.join(', ')} `}
                  {d.changed.length > 0 && `změněno ${d.changed.join(', ')}`}
                </li>
              ))}
              {res.diff.settings.map((s) => (
                <li key={s}>
                  <b>{s}</b>: změněno
                </li>
              ))}
            </ul>
          )}
          {warnings.length > 0 && (
            <details>
              <summary>Upozornění ({warnings.length})</summary>
              <ul>{warnings.map((i, k) => <li key={k}>{i.path}: {i.message}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
