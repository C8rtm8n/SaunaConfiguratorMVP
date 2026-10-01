/**
 * M2 demo without UI. Keys: 1/2/3 reference config, S section mode,
 * P export 4 snapshots (download), M move heater (shows partial rebuild).
 * Query: ?ref=1..3&section=1
 */
import { evaluate, type SaunaConfig } from '@sauna/core';
import { DEMO_CATALOG, REFERENCE_CONFIGS } from '@sauna/core/fixtures';
import { SaunaViewer } from '../src/index.js';

performance.mark('script-start');
const refs = Object.values(REFERENCE_CONFIGS) as SaunaConfig[];
const q = new URLSearchParams(location.search);
let current: SaunaConfig = JSON.parse(JSON.stringify(refs[Number(q.get('ref') ?? 1) - 1] ?? refs[0]));

const viewer = new SaunaViewer(document.getElementById('app')!);
performance.mark('viewer-created');
const info = document.getElementById('info')!;
let last = '';

function show(c: SaunaConfig) {
  const t0 = performance.now();
  const e = evaluate(c, DEMO_CATALOG);
  const t1 = performance.now();
  performance.mark('evaluated');
  const res = viewer.setScene(e.scene);
  performance.mark('synced');
  viewer.render();
  performance.mark('first-render');
  const t2 = performance.now();
  last = `${c.id}: evaluate ${(t1 - t0).toFixed(1)} ms, sync + render ${(t2 - t1).toFixed(1)} ms (rebuilt ${res.added.length + res.rebuilt.length}, kept ${res.kept.length})`;
  update();
  return e;
}

function update() {
  const s = viewer.stats();
  info.textContent = `${last}\ndraw calls ${s.drawCalls}, triangles ${s.triangles}, dpr ${s.dpr}, shadows ${s.shadows}, fps ${s.fps}\nsection ${viewer.sectionMode ? 'on' : 'off'}  [1/2/3] ref  [S] řez  [P] snímky  [M] posun kamen`;
}

viewer.on('slotclick', (s) => {
  last = `klik: slot ${s.wall}/${s.index}`;
  viewer.highlightSlots([s]);
  update();
});
viewer.on('quality', update);
if (q.get('section') === '1') viewer.setSectionMode(true);
show(current);

addEventListener('keydown', async (ev) => {
  if (ev.key >= '1' && ev.key <= '3') {
    current = JSON.parse(JSON.stringify(refs[Number(ev.key) - 1]));
    show(current);
  } else if (ev.key === 's') {
    viewer.setSectionMode(!viewer.sectionMode);
    update();
  } else if (ev.key === 'm') {
    current.sauna.heater.along_mm += 50;
    show(current);
  } else if (ev.key === 'p') {
    for (const s of await viewer.exportSnapshots()) {
      const a = document.createElement('a');
      a.href = s.dataUrl;
      a.download = `${current.id}-${s.view}.png`;
      a.click();
    }
  }
});
setInterval(update, 1000);

// For e2e tests.
Object.assign(window, { __viewer: viewer, __show: (i: number) => show(JSON.parse(JSON.stringify(refs[i]))), __ready: true });
