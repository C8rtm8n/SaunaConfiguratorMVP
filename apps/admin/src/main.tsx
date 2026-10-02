import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { ApiError, api, type Me } from './api.js';
import { CatalogPage } from './pages/CatalogPage.js';
import { LeadDetail } from './pages/LeadDetail.js';
import { Leads } from './pages/Leads.js';
import { Login } from './pages/Login.js';
import { RatesPage } from './pages/RatesPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import './styles.css';

function useHash(): string {
  const [h, setH] = useState(location.hash || '#/leads');
  useEffect(() => {
    const on = () => setH(location.hash || '#/leads');
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return h;
}

function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const hash = useHash();
  useEffect(() => {
    api<Me>('/auth/me').then(setMe, (e) => (e instanceof ApiError && e.status === 401 ? setMe(null) : setMe(null)));
  }, []);
  if (me === undefined) return <p class="muted pad">Načítám…</p>;
  if (me === null) return <Login />;
  const ro = me.role !== 'admin';
  const [, page, arg] = hash.split('/');
  let view;
  if (page === 'leads' && arg) view = <LeadDetail id={arg} />;
  else if (page === 'catalog') view = <CatalogPage list={arg ?? 'heaters'} readOnly={ro} />;
  else if (page === 'rates') view = <RatesPage readOnly={ro} />;
  else if (page === 'settings') view = <SettingsPage readOnly={ro} />;
  else view = <Leads />;
  const nav = [
    ['#/leads', 'Poptávky'],
    ['#/catalog/heaters', 'Katalog'],
    ['#/rates', 'Sazby'],
    ['#/settings', 'Nastavení'],
  ];
  return (
    <div class="shell">
      <header>
        <strong>{me.tenant.name}</strong>
        <nav>
          {nav.map(([href, label]) => (
            <a key={href} href={href} class={hash.startsWith(href!.split('/').slice(0, 2).join('/')) ? 'on' : ''}>
              {label}
            </a>
          ))}
        </nav>
        <span class="muted small">
          {me.email} ({me.role})
        </span>
        <button
          type="button"
          class="btn small ghost"
          onClick={async () => {
            await api('/auth/logout', { method: 'POST' });
            setMe(null);
          }}
        >
          Odhlásit
        </button>
      </header>
      <main>{view}</main>
    </div>
  );
}

render(<App />, document.getElementById('app')!);
Object.assign(window, { __ready: true });
