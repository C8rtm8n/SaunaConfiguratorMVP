import { useEffect, useRef, useState } from 'preact/hooks';
import type { SaunaViewer } from '@sauna/viewer';
import { useApp } from '../state.js';

/** 3D view, loaded lazily so the wizard and the price are interactive first (D-039). */
export function ViewerPane() {
  const app = useApp();
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<SaunaViewer | null>(null);
  const appRef = useRef(app);
  appRef.current = app;
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState(false);

  useEffect(() => {
    let disposed = false;
    import('@sauna/viewer').then(({ SaunaViewer }) => {
      if (disposed || !host.current) return;
      const v = new SaunaViewer(host.current, { background: getComputedStyle(document.documentElement).getPropertyValue('--c-viewer').trim() || undefined });
      v.on('slotclick', (s) => {
        const a = appRef.current;
        if (s.wall === 'roof') return;
        if (a.step !== 3) {
          a.setWall(s.wall);
          a.setStep(3);
        } else a.setSlotClick({ ...s, n: Date.now() });
      });
      viewer.current = v;
      v.setScene(appRef.current.ev.scene);
      Object.assign(window, { __viewer: v });
      setReady(true);
    });
    return () => {
      disposed = true;
      viewer.current?.dispose();
      viewer.current = null;
    };
  }, []);

  useEffect(() => {
    viewer.current?.setScene(app.ev.scene);
  }, [app.ev, ready]);

  useEffect(() => {
    viewer.current?.highlightSlots(app.highlight);
  }, [app.highlight, ready]);

  const { t } = app.i18n;
  return (
    <div class="viewer">
      <div class="viewer-canvas" ref={host} />
      {!ready && <div class="viewer-loading">{t('viewer.loading')}</div>}
      <div class="viewer-tools">
        <button
          type="button"
          class={`btn small${section ? ' on' : ''}`}
          aria-pressed={section}
          onClick={() => {
            viewer.current?.setSectionMode(!section);
            setSection(!section);
          }}
        >
          {t('viewer.section')}
        </button>
      </div>
      <p class="viewer-hint">{t('viewer.hint')}</p>
    </div>
  );
}
