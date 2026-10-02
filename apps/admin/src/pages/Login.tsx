import { useState } from 'preact/hooks';
import { api } from '../api.js';

export function Login() {
  const [tenant, setTenant] = useState(new URLSearchParams(location.search).get('tenant') ?? 'demo');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: Event) => {
    e.preventDefault();
    setErr('');
    try {
      await api('/auth/magic-link', { method: 'POST', json: { tenant, email } });
      setSent(true);
    } catch {
      setErr('Odeslání se nezdařilo, zkuste to za chvíli znovu.');
    }
  };
  return (
    <main class="login">
      <h1>Administrace konfigurátoru</h1>
      {sent ? (
        <p class="ok" role="status">
          Pokud je e-mail registrovaný, poslali jsme na něj přihlašovací odkaz (platí 15 minut).
        </p>
      ) : (
        <form onSubmit={submit} class="form">
          <label class="field">
            <span>Výrobce (slug)</span>
            <input name="tenant" value={tenant} onInput={(e) => setTenant((e.target as HTMLInputElement).value)} required />
          </label>
          <label class="field">
            <span>E-mail</span>
            <input name="email" type="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} required autoComplete="email" />
          </label>
          {err && <p class="err">{err}</p>}
          <button class="btn primary" type="submit">
            Poslat přihlašovací odkaz
          </button>
        </form>
      )}
    </main>
  );
}
