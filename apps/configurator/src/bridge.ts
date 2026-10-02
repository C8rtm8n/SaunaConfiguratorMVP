import { make, parse, type ToFrame, type ToHost } from '@sauna/embed/protocol';

/** Configurator side of the embed protocol (D-038). No-op when not embedded. */
export class Bridge {
  hostHref: string | null = null;
  private ro?: ResizeObserver;
  private lastHeight = 0;

  constructor(private readonly hostOrigin: string | undefined) {
    if (!hostOrigin) return;
    window.addEventListener('message', (ev) => {
      if (ev.origin !== hostOrigin || ev.source !== window.parent) return;
      const m = parse<ToFrame>(ev.data);
      if (m?.type === 'host') this.hostHref = (m.payload as ToFrame['host']).href;
    });
  }

  /** Starts height reporting once the app has rendered (no shrink to the loading state, D-054). */
  start(): void {
    if (!this.hostOrigin || this.ro) return;
    this.ro = new ResizeObserver(() => this.postHeight());
    this.ro.observe(document.documentElement);
  }

  get embedded(): boolean {
    return !!this.hostOrigin;
  }

  send<K extends keyof ToHost>(type: K, payload: ToHost[K]): void {
    if (this.hostOrigin) window.parent.postMessage(make<ToHost, K>(type, payload), this.hostOrigin);
  }

  postHeight(): void {
    const h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (Math.abs(h - this.lastHeight) < 2) return;
    this.lastHeight = h;
    this.send('resize', { height: h });
  }
}
