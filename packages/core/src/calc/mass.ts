import type { AssemblyId, BomLine } from '../model/bom.js';
import type { MassReport } from '../model/results.js';
import { weightedCentre } from '../util/math.js';

/** Mass and COG per assembly; empty (installed) and transport state (D-015). */
export function massReport(bom: readonly BomLine[]): MassReport {
  const module = bom.filter((l) => l.assembly !== 'foundation');
  const byAssembly: MassReport['byAssembly'] = {};
  const groups = new Map<AssemblyId, BomLine[]>();
  for (const l of module) groups.set(l.assembly, [...(groups.get(l.assembly) ?? []), l]);
  for (const [a, ls] of groups) {
    byAssembly[a] = { mass_kg: ls.reduce((s, l) => s + l.mass_kg, 0), cog_mm: weightedCentre(ls.map((l) => ({ m: l.mass_kg, c: l.cog_mm }))) };
  }
  const transport = module.filter((l) => l.transport === 'fixed');
  const demounted = new Map<AssemblyId, number>();
  for (const l of module) if (l.transport === 'demounted') demounted.set(l.assembly, (demounted.get(l.assembly) ?? 0) + l.mass_kg);
  return {
    byAssembly,
    empty_kg: module.reduce((s, l) => s + l.mass_kg, 0),
    empty_cog_mm: weightedCentre(module.map((l) => ({ m: l.mass_kg, c: l.cog_mm }))),
    transport_kg: transport.reduce((s, l) => s + l.mass_kg, 0),
    transport_cog_mm: weightedCentre(transport.map((l) => ({ m: l.mass_kg, c: l.cog_mm }))),
    foundation_kg: bom.filter((l) => l.assembly === 'foundation').reduce((s, l) => s + l.mass_kg, 0),
    demounted: [...demounted].map(([assembly, mass_kg]) => ({ assembly, mass_kg })),
  };
}
