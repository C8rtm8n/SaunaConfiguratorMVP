import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.js';
import { STATUS, czk, date } from '../format.js';

interface Lead {
  id: string;
  configId: string;
  revision: number;
  status: string;
  contact: { name: string; email: string; phone: string; postalCode: string; term: string; budget: string };
  priceTotal: number;
  deliveredAt: string | null;
  createdAt: string;
}

export function Leads() {
  const [rows, setRows] = useState<Lead[] | null>(null);
  const [filter, setFilter] = useState('');
  const load = () => api<Lead[]>('/admin/leads').then(setRows);
  useEffect(() => void load(), []);
  const setStatus = async (id: string, status: string) => {
    await api(`/admin/leads/${id}`, { method: 'PATCH', json: { status } });
    await load();
  };
  if (!rows) return <p class="muted">Načítám…</p>;
  const shown = rows.filter((r) => !filter || r.status === filter);
  return (
    <section>
      <div class="bar">
        <h2>Poptávky ({rows.length})</h2>
        <select name="statusFilter" value={filter} onChange={(e) => setFilter((e.target as HTMLSelectElement).value)}>
          <option value="">Všechny stavy</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option value={k} key={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {shown.length === 0 ? (
        <p class="muted">Zatím žádné poptávky.</p>
      ) : (
        <table class="list">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Zákazník</th>
              <th>PSČ</th>
              <th class="n">Cena bez DPH</th>
              <th>Doručeno</th>
              <th>Stav</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id} data-lead={l.id}>
                <td>{date(l.createdAt)}</td>
                <td>
                  <a href={`#/leads/${l.id}`}>{l.contact.name}</a>
                  <div class="muted small">{l.contact.email}</div>
                </td>
                <td>{l.contact.postalCode}</td>
                <td class="n">{czk(l.priceTotal)}</td>
                <td>{l.deliveredAt ? '✓' : '…'}</td>
                <td>
                  <select name={`status-${l.id}`} value={l.status} onChange={(e) => setStatus(l.id, (e.target as HTMLSelectElement).value)}>
                    {Object.entries(STATUS).map(([k, v]) => (
                      <option value={k} key={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
