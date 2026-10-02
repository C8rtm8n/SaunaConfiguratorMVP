import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Catalog } from '@sauna/core';
import { API, ApiError, api } from '../api.js';
import { LISTS, setPath } from '../catalogSpec.js';
import { Publish } from '../components/Publish.js';
import { TableEditor } from '../components/TableEditor.js';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function CatalogPage(p: { list: string; readOnly: boolean }) {
  const [base, setBase] = useState<Catalog | null>(null);
  const [draft, setDraft] = useState<Catalog | null>(null);
  const [json, setJson] = useState('');
  const [jsonErr, setJsonErr] = useState('');
  const [importRes, setImportRes] = useState<string>('');
  const load = () =>
    api<Catalog>('/admin/catalog').then((c) => {
      setBase(c);
      setDraft(clone(c));
      setJson(JSON.stringify(c, null, 2));
    });
  useEffect(() => void load(), []);
  const dirty = useMemo(() => !!base && !!draft && JSON.stringify(base) !== JSON.stringify(draft), [base, draft]);
  if (!draft || !base) return <p class="muted">Načítám…</p>;
  const spec = LISTS.find((l) => l.key === p.list);
  const rows = spec ? (draft[spec.key] as unknown as Array<Record<string, unknown>>) : [];

  const change = (i: number, path: string, v: unknown) => {
    const d = clone(draft);
    setPath((d[spec!.key] as unknown as Array<Record<string, unknown>>)[i]!, path, v);
    setDraft(d);
  };
  const add = () => {
    const d = clone(draft);
    const list = d[spec!.key] as unknown as Array<Record<string, unknown>>;
    const copy = clone(list[list.length - 1] ?? {});
    let n = 1;
    while (list.some((x) => x['sku'] === `NEW-${n}`)) n++;
    copy['sku'] = `NEW-${n}`;
    list.push(copy);
    setDraft(d);
  };
  const remove = (i: number) => {
    const d = clone(draft);
    (d[spec!.key] as unknown as unknown[]).splice(i, 1);
    setDraft(d);
  };
  const importXlsx = async (f: File, dryRun: boolean) => {
    const fd = new FormData();
    fd.set('file', f);
    if (dryRun) fd.set('dryRun', '1');
    try {
      const r = await api<{ version?: string; diff: { lists: Record<string, { added: string[]; removed: string[]; changed: string[] }>; settings: string[] }; issues: Array<{ level: string; path: string; message: string }> }>('/admin/catalog/import', { method: 'POST', body: fd });
      const lists = Object.entries(r.diff.lists).map(([k, d]) => `${k}: +${d.added.length} −${d.removed.length} ~${d.changed.length}`);
      setImportRes(`${dryRun ? 'Náhled importu' : `Importováno jako ${r.version}`}: ${[...lists, ...r.diff.settings.map((s) => `${s}: změněno`)].join('; ') || 'beze změn'}`);
      if (!dryRun) await load();
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as { issues?: Array<{ level: string; path: string; message: string }>; error?: string }) : undefined;
      setImportRes(`Import odmítnut: ${body?.issues?.filter((i) => i.level === 'error').map((i) => `${i.path}: ${i.message}`).join('; ') ?? body?.error ?? 'chyba'}`);
    }
  };

  return (
    <section>
      <div class="bar">
        <h2>Katalog · verze {base.version}</h2>
        <div class="row">
          <a class="btn small" href={`${API}/admin/catalog/export.xlsx`} data-testid="export-xlsx">
            Export XLSX
          </a>
          {!p.readOnly && (
            <label class="btn small">
              Import XLSX…
              <input
                type="file"
                name="importXlsx"
                accept=".xlsx"
                hidden
                onChange={async (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) await importXlsx(f, true);
                  (window as unknown as { __importFile?: File }).__importFile = f;
                }}
              />
            </label>
          )}
          {importRes.startsWith('Náhled') && (
            <button type="button" class="btn small primary" onClick={() => importXlsx((window as unknown as { __importFile: File }).__importFile, false)}>
              Potvrdit import
            </button>
          )}
        </div>
      </div>
      {importRes && <p class={importRes.startsWith('Import odmítnut') ? 'err' : 'ok'} data-testid="import-result">{importRes}</p>}
      <nav class="tabs">
        {LISTS.map((l) => (
          <a key={l.key} href={`#/catalog/${l.key}`} class={l.key === p.list ? 'on' : ''}>
            {l.label} ({(draft[l.key] as unknown[]).length})
          </a>
        ))}
        <a href="#/catalog/json" class={p.list === 'json' ? 'on' : ''}>
          Pokročilé (JSON)
        </a>
      </nav>
      {spec ? (
        <TableEditor cols={spec.cols} rows={rows} readOnly={p.readOnly} onChange={change} onAdd={add} onRemove={remove} issues={new Map()} />
      ) : (
        <div>
          <p class="muted small">Celý katalog včetně skladeb, rámů, pravidel a limitů. Změny se projeví po „Použít JSON“ a publikaci.</p>
          <textarea name="catalogJson" class="json" value={json} readOnly={p.readOnly} onInput={(e) => setJson((e.target as HTMLTextAreaElement).value)} />
          {!p.readOnly && (
            <button
              type="button"
              class="btn small"
              onClick={() => {
                try {
                  setDraft(JSON.parse(json) as Catalog);
                  setJsonErr('');
                } catch (e) {
                  setJsonErr((e as Error).message);
                }
              }}
            >
              Použít JSON
            </button>
          )}
          {jsonErr && <p class="err">{jsonErr}</p>}
        </div>
      )}
      <Publish draft={draft} dirty={dirty} readOnly={p.readOnly} onPublished={() => void load()} />
    </section>
  );
}
