import type { CatalogIndex } from '../model/catalog.js';
import type { ModuleGeometry } from '../model/component.js';
import type { Config, WallId } from '../model/config.js';
import type { Slot, SlotLayout, SlotMap } from '../model/slots.js';
import type { Mm } from '../model/units.js';
import { frameRecipe } from './module.js';
import { EXTERIOR_WALLS, wallFrame } from './walls.js';

/** Corner post width blocking the wall ends (column profile / container corner post). */
export function cornerPost(config: Config, idx: CatalogIndex): Mm {
  if (config.module.type === 'iso_20hc') return container(config, idx).cornerPost_mm;
  const col = frameRecipe(config, idx).members.column_corner;
  if (!col) return 0;
  const sec = idx.get('steel_profile', col.profile).section;
  return sec.shape === 'RHS' ? sec.b : sec.shape === 'U' ? sec.b : sec.a;
}

export function container(config: Config, idx: CatalogIndex) {
  const c = idx.all('container').find((x) => x.active && x.L_mm === config.module.L_mm && x.W_mm === config.module.W_mm);
  if (!c) throw new Error(`no active container matching ${config.module.L_mm}×${config.module.W_mm}`);
  return c;
}

/** Centred slots on [from, to]; remainder split into two fillers (D-007). */
export function layoutSlots(surface: WallId | 'roof', axis: 'x' | 'y', from: Mm, to: Mm, grid: Mm, clear: [Mm, Mm]): SlotLayout {
  const len = to - from;
  const n = Math.max(0, Math.floor(len / grid + 1e-9));
  const rest = (len - n * grid) / 2;
  const slots: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const a = from + rest + i * grid;
    const b = a + grid;
    slots.push({ index: i, from_mm: a, to_mm: b, clearFrom_mm: Math.max(a, clear[0]), clearTo_mm: Math.min(b, clear[1]) });
  }
  const fillers = rest > 1e-9 ? [{ from_mm: from, to_mm: from + rest }, { from_mm: to - rest, to_mm: to }] : [];
  return { surface, axis, from_mm: from, to_mm: to, slots, fillers };
}

export function buildSlots(config: Config, idx: CatalogIndex, geo: ModuleGeometry): SlotMap {
  const grid = config.module.grid_mm;
  const post = cornerPost(config, idx);
  const map: SlotMap = {};
  for (const w of EXTERIOR_WALLS) {
    const f = wallFrame(w);
    const axis = f.axis === 0 ? 'x' : 'y';
    map[w] = layoutSlots(w, axis, geo.envelope.min[f.axis], geo.envelope.max[f.axis], grid, [
      geo.structure.min[f.axis] + post,
      geo.structure.max[f.axis] - post,
    ]);
  }
  for (const p of geo.partitions) {
    map[p.id] = layoutSlots(p.id, 'y', geo.inner.min[1], geo.inner.max[1], grid, [geo.inner.min[1], geo.inner.max[1]]);
  }
  map.roof = layoutSlots('roof', 'x', geo.envelope.min[0], geo.envelope.max[0], grid, [geo.structure.min[0], geo.structure.max[0]]);

  for (const o of config.openings) {
    const lay = map[o.wall];
    if (!lay) continue;
    for (const s of lay.slots) if (s.index >= o.slotFrom && s.index <= o.slotTo && !s.occupiedBy) s.occupiedBy = o.id;
  }
  return map;
}
