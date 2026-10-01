import type { BuildContext } from '../model/component.js';
import type { OpeningProduct } from '../model/catalog.js';
import type { Opening } from '../model/config.js';
import type { Mm } from '../model/units.js';

/** Placed rough opening on its wall: along range, z range (module coordinates). */
export interface PlacedOpening {
  opening: Opening;
  product: OpeningProduct;
  along: [Mm, Mm];
  z: [Mm, Mm];
  slotSpan: [Mm, Mm];
  /** Slot clear span (corner posts excluded). */
  clearSpan: [Mm, Mm];
}

/**
 * Product is centred in its slot span (full-wall products: in the clear band).
 * Returns undefined when the slots do not exist (reported by rule S01).
 */
export function placeOpening(ctx: BuildContext, o: Opening): PlacedOpening | undefined {
  const product = ctx.catalog.find('opening', o.sku);
  const lay = ctx.slots[o.wall];
  if (!product || !lay) return undefined;
  const first = lay.slots[o.slotFrom];
  const last = lay.slots[o.slotTo];
  if (!first || !last || o.slotTo < o.slotFrom) return undefined;
  const span: [Mm, Mm] = [first.from_mm, last.to_mm];
  const clear: [Mm, Mm] = [first.clearFrom_mm, last.clearTo_mm];
  const centre = product.fullWall ? (clear[0] + clear[1]) / 2 : (span[0] + span[1]) / 2;
  const z0 = ctx.geo.inner.min[2] + product.sill_mm;
  return {
    opening: o,
    product,
    along: [centre - product.width_mm / 2, centre + product.width_mm / 2],
    z: [z0, z0 + product.height_mm],
    slotSpan: span,
    clearSpan: clear,
  };
}

export function placedOpenings(ctx: BuildContext): PlacedOpening[] {
  const out: PlacedOpening[] = [];
  for (const o of ctx.config.openings) {
    const p = placeOpening(ctx, o);
    if (p) out.push(p);
  }
  return out;
}
