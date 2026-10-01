import type { BomLine } from '../model/bom.js';
import type { Rates } from '../model/catalog.js';
import type { Config } from '../model/config.js';
import type { PriceBreakdown, TransportReport } from '../model/results.js';

const roundTo = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v);

/** D-011: price = Σ cost × (1 + category margin); transport and crane per tenant rates. */
export function priceBreakdown(config: Config, rates: Rates, bom: readonly BomLine[], transport: TransportReport): PriceBreakdown {
  const sumMat = (cat: BomLine['category']) => bom.filter((l) => l.category === cat).reduce((s, l) => s + l.materialCost, 0);
  const steel = sumMat('steel');
  const timber = sumMat('timber');
  const purchased = sumMat('purchased');
  const labour = bom.reduce((s, l) => s + l.labourCost, 0);
  const km = config.delivery?.distance_km ?? rates.transport.defaultDistance_km;
  const tr = rates.transport.flat + rates.transport.per_km * km + (transport.oversize ? rates.transport.oversizeSurcharge : 0);
  const crane = transport.needsMobileCrane ? rates.crane.flat + rates.crane.per_h * rates.crane.defaultHours : 0;
  const m = rates.margin;
  const price = {
    steel: steel * (1 + m.steel),
    timber: timber * (1 + m.timber),
    purchased: purchased * (1 + m.purchased),
    labour: labour * (1 + m.labour),
    transport: tr * (1 + m.transport),
    crane: crane * (1 + m.crane),
    total: 0,
  };
  price.total = price.steel + price.timber + price.purchased + price.labour + price.transport + price.crane;
  const cost = { steel, timber, purchased, labour, transport: tr, crane, total: steel + timber + purchased + labour + tr + crane };
  const step = rates.priceRounding_czk;
  const display: PriceBreakdown['display'] =
    rates.priceDisplay === 'hidden'
      ? { mode: 'hidden' }
      : rates.priceDisplay === 'range'
        ? { mode: 'range', from: roundTo(price.total * (1 - rates.priceRange), step), to: roundTo(price.total * (1 + rates.priceRange), step) }
        : { mode: 'exact', value: roundTo(price.total, step) };
  return { cost, price, total: price.total, display };
}
