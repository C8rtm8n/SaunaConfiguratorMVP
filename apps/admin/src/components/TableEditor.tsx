import type { Col } from '../catalogSpec.js';
import { getPath } from '../catalogSpec.js';

/** Spreadsheet-like editor for one catalog list. */
export function TableEditor(p: { cols: Col[]; rows: Array<Record<string, unknown>>; readOnly: boolean; onChange: (i: number, path: string, v: unknown) => void; onAdd: () => void; onRemove: (i: number) => void; issues: Map<number, string[]> }) {
  return (
    <div class="tablewrap">
      <table class="grid">
        <thead>
          <tr>
            {p.cols.map((c) => (
              <th key={c.path} style={{ minWidth: `${c.width ?? 90}px` }}>
                {c.label}
              </th>
            ))}
            {!p.readOnly && <th />}
          </tr>
        </thead>
        <tbody>
          {p.rows.map((r, i) => (
            <tr key={i} class={p.issues.has(i) ? 'bad' : ''} title={p.issues.get(i)?.join('\n')}>
              {p.cols.map((c) => {
                const v = getPath(r, c.path);
                const name = `${i}:${c.path}`;
                if (c.type === 'bool')
                  return (
                    <td key={c.path} class="c">
                      <input type="checkbox" name={name} disabled={p.readOnly} checked={v === true} onChange={(e) => p.onChange(i, c.path, (e.target as HTMLInputElement).checked)} />
                    </td>
                  );
                if (typeof c.type === 'object')
                  return (
                    <td key={c.path}>
                      <select name={name} disabled={p.readOnly} value={String(v ?? '')} onChange={(e) => p.onChange(i, c.path, (e.target as HTMLSelectElement).value)}>
                        {c.type.options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </td>
                  );
                return (
                  <td key={c.path}>
                    <input
                      name={name}
                      disabled={p.readOnly}
                      type={c.type === 'number' ? 'number' : 'text'}
                      step="any"
                      value={v === undefined || v === null ? '' : String(v)}
                      onChange={(e) => {
                        const s = (e.target as HTMLInputElement).value;
                        p.onChange(i, c.path, c.type === 'number' ? (s === '' ? undefined : Number(s)) : s);
                      }}
                    />
                  </td>
                );
              })}
              {!p.readOnly && (
                <td>
                  <button type="button" class="btn small ghost" title="Odebrat" onClick={() => p.onRemove(i)}>
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!p.readOnly && (
        <button type="button" class="btn small" onClick={p.onAdd}>
          + Přidat (kopie posledního řádku)
        </button>
      )}
    </div>
  );
}
