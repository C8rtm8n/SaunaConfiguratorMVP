/**
 * embed.js – loader for the host page (< 5 kB).
 *
 * <script src="https://cdn.example.com/embed.js" data-tenant="demo" data-lang="cs" async></script>
 * <div data-sauna-configurator></div>
 *
 * - The iframe is created when the container scrolls into view, or on poster click
 *   with data-load="click". No cookies; the host page only gets postMessage events.
 * - Height follows the iframe content (resize messages).
 * - Events: DOM CustomEvent `sauna:<type>` on the container + window.dataLayer push (GA4/GTM).
 */
import { ANALYTICS_EVENTS, make, parse, type ToFrame, type ToHost } from './protocol.js';

declare global {
  interface Window {
    dataLayer?: unknown[];
    __saunaEmbed?: boolean;
  }
}

(function () {
  if (window.__saunaEmbed) return;
  window.__saunaEmbed = true;
  const script = (document.currentScript as HTMLScriptElement | null) ?? document.querySelector<HTMLScriptElement>('script[data-tenant][src*="embed"]');
  const sd = script?.dataset ?? {};
  // Configurator URL: data-src, or "configurator/" next to embed.js.
  const appUrl = new URL(sd['src'] ?? 'configurator/', script?.src ?? location.href);

  function mount(el: HTMLElement) {
    if (el.dataset['saunaMounted']) return;
    el.dataset['saunaMounted'] = '1';
    const d = { ...sd, ...el.dataset };
    const tenant = d['tenant'] ?? 'demo';
    el.style.position = 'relative';
    // Reserve the expected configurator height up front (no layout shift when the iframe loads, D-054):
    // narrow = 3D view 4:3 above the wizard, wide = two columns. data-height overrides.
    const w = el.clientWidth || window.innerWidth;
    const reserve = Number(d['height']) || Math.round(w < 900 ? w * 0.75 + 740 : 790);
    el.style.minHeight = `${reserve}px`;

    const poster = document.createElement('button');
    poster.type = 'button';
    poster.textContent = d['label'] ?? 'Konfigurátor sauny';
    poster.setAttribute('aria-label', poster.textContent);
    poster.style.cssText = `all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;justify-content:center;width:100%;min-height:${reserve}px;border-radius:12px;font:600 18px/1.3 system-ui,sans-serif;color:#fff;background:#3b2a20 center/cover no-repeat`;
    const posterUrl = d['poster'] ?? new URL(`posters/${tenant}.webp`, appUrl).href;
    poster.style.backgroundImage = `linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.25)),url("${posterUrl}")`;
    el.appendChild(poster);

    let frame: HTMLIFrameElement | undefined;
    const load = () => {
      if (frame) return;
      const q = new URLSearchParams({ tenant, embed: '1', origin: location.origin });
      if (d['lang']) q.set('lang', d['lang']);
      const c = new URLSearchParams(location.search).get('c');
      if (c) q.set('c', c);
      frame = document.createElement('iframe');
      frame.src = `${appUrl.href}?${q}`;
      frame.title = poster.textContent ?? 'Sauna';
      frame.allow = 'fullscreen; clipboard-write';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.style.cssText = `display:block;width:100%;height:${reserve}px;border:0;border-radius:12px`;
      frame.addEventListener('load', () => send({ ...make<ToFrame, 'host'>('host', { href: location.href }) }));
      el.replaceChild(frame, poster);
    };
    const send = (m: unknown) => frame?.contentWindow?.postMessage(m, appUrl.origin);

    window.addEventListener('message', (ev) => {
      if (!frame || ev.source !== frame.contentWindow || ev.origin !== appUrl.origin) return;
      const m = parse<ToHost>(ev.data);
      if (!m) return;
      if (m.type === 'resize') {
        const h = (m.payload as ToHost['resize']).height;
        if (h > 0 && h < 20000) {
          frame.style.height = `${Math.ceil(h)}px`;
          el.style.minHeight = '';
        }
        return;
      }
      if (m.type === 'ready') send(make<ToFrame, 'host'>('host', { href: location.href }));
      el.dispatchEvent(new CustomEvent(`sauna:${String(m.type)}`, { detail: m.payload, bubbles: true }));
      if (ANALYTICS_EVENTS.includes(m.type)) {
        (window.dataLayer = window.dataLayer || []).push({ event: `sauna_${String(m.type)}`, sauna_tenant: tenant, ...(m.payload as object) });
      }
    });

    poster.addEventListener('click', load);
    if (d['load'] !== 'click') {
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(
          (es) => {
            if (es.some((e) => e.isIntersecting)) {
              io.disconnect();
              load();
            }
          },
          { rootMargin: '200px' },
        );
        io.observe(el);
      } else load();
    }
  }

  const scan = () => document.querySelectorAll<HTMLElement>('[data-sauna-configurator]').forEach(mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
})();
