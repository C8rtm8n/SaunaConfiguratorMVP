import type { BomLine } from '../model/bom.js';
import type { BuildContext } from '../model/component.js';
import type { MassReport, TransportReport } from '../model/results.js';
import type { SceneNode } from '../model/scene.js';

/** Bounding box of fixed (non-demounted) geometry: envelope + fixed attachments. */
export function transportReport(ctx: BuildContext, mass: MassReport, bom: readonly BomLine[], fixedNodes: readonly SceneNode[]): TransportReport {
  const lim = ctx.catalog.catalog.limits.transport;
  const e = ctx.geo.envelope;
  const min = [...e.min] as [number, number, number];
  const max = [...e.max] as [number, number, number];
  const visit = (n: SceneNode) => {
    if (n.type === 'group') return n.children.forEach(visit);
    if (n.type === 'box' || n.type === 'asset') {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i]!, n.min[i]!);
        max[i] = Math.max(max[i]!, n.min[i]! + n.size[i]!);
      }
    }
  };
  fixedNodes.forEach(visit);
  const width = max[1] - min[1];
  const length = max[0] - min[0];
  const height = max[2] - min[2];
  const vehicle = lim.vehicles.find((v) => v.maxMass_kg >= mass.transport_kg) ?? lim.vehicles[lim.vehicles.length - 1]!;
  const hOn = height + vehicle.deckHeight_mm;
  const reasons: TransportReport['oversizeReasons'] = [];
  if (width > lim.maxWidth_mm.value) reasons.push('width');
  if (hOn > lim.maxHeightOnVehicle_mm.value) reasons.push('height');
  if (mass.transport_kg > vehicle.maxMass_kg) reasons.push('mass');
  return {
    width_mm: width,
    length_mm: length,
    height_mm: height,
    vehicleId: vehicle.id,
    deckHeight_mm: vehicle.deckHeight_mm,
    heightOnVehicle_mm: hOn,
    needsMobileCrane: vehicle.needsMobileCrane,
    oversize: reasons.length > 0,
    oversizeReasons: reasons,
    mass_kg: mass.transport_kg,
    demountedParts: [...new Set(bom.filter((l) => l.transport === 'demounted' && l.assembly !== 'foundation').map((l) => l.sku))].sort(),
  };
}
