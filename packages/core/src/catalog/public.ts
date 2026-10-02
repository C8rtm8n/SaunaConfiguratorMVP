import type { Catalog, PriceCategory, PublicCatalog } from '../model/catalog.js';

/**
 * D-035: public (sell-price) catalog for the browser. Each cost field is multiplied
 * by (1 + margin of its price category) and margins are set to 0. Prices are linear
 * in these fields, so evaluate(public) = evaluate(tenant) for price, BOM and mass,
 * while purchase prices and margins stay on the server.
 */
export function toPublicCatalog(c: Catalog): PublicCatalog {
  if (c.pricing === 'sell') return c as PublicCatalog;
  // Price display 'hidden': the browser gets no prices at all (zero factor).
  if (c.rates.priceDisplay === 'hidden') return scaled(c, () => 0);
  const m = c.rates.margin;
  return scaled(c, (cat) => 1 + m[cat]);
}

function scaled(c: Catalog, k: (cat: PriceCategory) => number): PublicCatalog {
  const m = c.rates.margin;
  const zero = Object.fromEntries(Object.keys(m).map((x) => [x, 0])) as Record<PriceCategory, number>;
  return {
    ...c,
    pricing: 'sell',
    steel: c.steel.map((x) => ({ ...x, cost_per_kg: x.cost_per_kg * k('steel'), coating_cost_per_m2: x.coating_cost_per_m2 * k('steel') })),
    timber: c.timber.map((x) => ({ ...x, cost_per_m: x.cost_per_m * k('timber') })),
    panels: c.panels.map((x) => ({ ...x, cost_per_m2: x.cost_per_m2 * k('timber') })),
    containers: c.containers.map((x) => ({ ...x, cost: x.cost * k('purchased') })),
    openings: c.openings.map((x) => ({ ...x, cost: x.cost * k('purchased') })),
    heaters: c.heaters.map((x) => ({ ...x, cost: x.cost * k('purchased') })),
    purchased: c.purchased.map((x) => ({ ...x, cost: x.cost * k('purchased') })),
    attachmentSystems: c.attachmentSystems.map((x) => ({ ...x, cost_per_unit: x.cost_per_unit * k('purchased') })),
    rates: {
      ...c.rates,
      labour_per_h: c.rates.labour_per_h * k('labour'),
      transport: {
        ...c.rates.transport,
        per_km: c.rates.transport.per_km * k('transport'),
        flat: c.rates.transport.flat * k('transport'),
        oversizeSurcharge: c.rates.transport.oversizeSurcharge * k('transport'),
      },
      crane: { ...c.rates.crane, flat: c.rates.crane.flat * k('crane'), per_h: c.rates.crane.per_h * k('crane') },
      margin: zero,
    },
  } as PublicCatalog;
}
