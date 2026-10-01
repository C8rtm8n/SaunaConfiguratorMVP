import type { BomLine } from './model/bom.js';
import type { Catalog } from './model/catalog.js';
import type { BuildContext, BuildResult, ComponentBuilder, ComponentInstance, Penetration } from './model/component.js';
import type { Config } from './model/config.js';
import type { ProductLinePack } from './model/productLine.js';
import { EVALUATION_SCHEMA_VERSION, type Evaluation, type LiftReactions, type SaunaReport, type SupportLoads } from './model/results.js';
import type { Facts } from './model/rules.js';
import type { GroupNode, SceneNode } from './model/scene.js';
import { aggregateBom } from './bom/aggregate.js';
import { massReport } from './calc/mass.js';
import { priceBreakdown } from './calc/price.js';
import { rigidReactions, spread } from './calc/reactions.js';
import { transportReport } from './calc/transport.js';
import { createCatalogIndex } from './catalog/index.js';
import { moduleGeometry } from './geometry/module.js';
import { group } from './geometry/scene.js';
import { buildSlots } from './geometry/slots.js';
import { EXTERIOR_WALLS } from './geometry/walls.js';
import { SAUNA_PACK } from './packs/sauna/index.js';
import { electricalFor, suitableHeaters } from './packs/sauna/checks.js';
import { runAutoRules, runCheckRules, type RuleRegistry } from './rules/engine.js';
import { buildAttachment } from './shell/attachments.js';
import { SHELL_AUTOS, SHELL_CHECKS } from './shell/checks.js';
import { buildFloor, buildPartition, buildRoof, buildWall } from './shell/envelope.js';
import { buildCustomFrame, liftingPoints } from './shell/frameCustom.js';
import { buildIsoFrame } from './shell/frameIso.js';
import { buildFoundation, supportPoints } from './shell/foundation.js';
import { buildOpening, buildReinforcement } from './shell/openings.js';
import { hash } from './util/hash.js';
import { round, weightedCentre } from './util/math.js';

const PACKS: Record<Config['productLine'], ProductLinePack> = { sauna: SAUNA_PACK };

const SHELL_BUILDERS: Record<string, ComponentBuilder> = {
  'frame.custom': buildCustomFrame,
  'frame.iso': buildIsoFrame,
  'shell.wall': buildWall,
  'shell.roof': buildRoof,
  'shell.floor': buildFloor,
  'shell.partition': buildPartition,
  'shell.opening': buildOpening,
  'shell.reinforcement': buildReinforcement,
  'shell.attachment': buildAttachment,
  'shell.foundation': buildFoundation,
};

function shellComponents(config: Config, ctx: BuildContext): ComponentInstance[] {
  return [
    { id: 'frame', builder: config.module.type === 'custom_frame' ? 'frame.custom' : 'frame.iso', params: {} },
    ...EXTERIOR_WALLS.map((wall) => ({ id: `wall-${wall}`, builder: 'shell.wall', params: { wall } })),
    { id: 'roof', builder: 'shell.roof', params: {} },
    { id: 'floor', builder: 'shell.floor', params: {} },
    ...ctx.geo.partitions.map((p) => ({ id: `partition-${p.id}`, builder: 'shell.partition', params: { id: p.id } })),
    ...config.openings.map((o) => ({ id: `opening-${o.id}`, builder: 'shell.opening', params: { openingId: o.id } })),
    ...config.attachments.map((a) => ({ id: `att-${a.id}`, builder: 'shell.attachment', params: { attachmentId: a.id } })),
    { id: 'foundation', builder: 'shell.foundation', params: {} },
  ];
}

function shellFacts(config: Config): Facts {
  const f: Record<string, string | number | boolean | null> = {
    'module.type': config.module.type,
    'module.L_mm': config.module.L_mm,
    'module.W_mm': config.module.W_mm,
    'module.H_mm': config.module.H_mm,
    'module.grid_mm': config.module.grid_mm,
    'openings.count': config.openings.length,
  };
  for (const z of config.zones) {
    const k = `zone.${z.type}.length_mm`;
    f[k] = ((f[k] as number | undefined) ?? 0) + (z.to_mm - z.from_mm);
  }
  return f;
}

/** Fills GroupNode.hash bottom-up (content hash → viewer diff by id + hash). */
function hashTree(n: SceneNode): void {
  if (n.type !== 'group') return;
  n.children.forEach(hashTree);
  n.hash = hash({ ...n, hash: '' });
}

/**
 * config → geometry → slots → facts → auto rules → components → build →
 * BOM / mass / COG / reactions / transport / price → check rules.
 * Pure and deterministic: same (config, catalog) → identical Evaluation.
 */
export function evaluate(config: Config, catalog: Catalog): Evaluation {
  const idx = createCatalogIndex(catalog);
  const pack = PACKS[config.productLine];
  const geo = moduleGeometry(config, idx);
  const slots = buildSlots(config, idx, geo);
  const ctx: BuildContext = { config, catalog: idx, slots, geo, auto: [] };
  const registry: RuleRegistry = {
    checks: { ...SHELL_CHECKS, ...pack.checks },
    autos: { ...SHELL_AUTOS, ...pack.autos },
    fixes: { none: () => null, ...pack.fixes },
  };

  const preFacts: Facts = { ...shellFacts(config), ...pack.facts(config, ctx) };
  ctx.auto = runAutoRules(catalog.rules, ctx, preFacts, registry);

  const components = [...shellComponents(config, ctx), ...pack.components(config, ctx), ...ctx.auto.flatMap((a) => a.components)];
  const builders = { ...SHELL_BUILDERS, ...pack.builders };
  const results = new Map<string, BuildResult>();
  for (const c of components) {
    const b = builders[c.builder];
    if (!b) throw new Error(`unknown builder '${c.builder}'`);
    if (results.has(c.id)) throw new Error(`duplicate component id '${c.id}'`);
    results.set(c.id, b(c.params, ctx));
  }

  const bom: BomLine[] = [...results.values()].flatMap((r) => r.bom);
  const penetrations: Penetration[] = [...results.values()].flatMap((r) => r.penetrations);
  for (const p of penetrations) {
    if (p.surface !== 'roof') continue;
    const s = slots.roof?.slots.find((r) => p.position_mm[0] >= r.from_mm && p.position_mm[0] < r.to_mm);
    if (s && !s.occupiedBy) s.occupiedBy = p.componentId;
  }
  const scene: GroupNode = group('module', [...results.values()].map((r) => r.geometry));
  hashTree(scene);
  const bomRows = aggregateBom(bom);

  // Mass, COG, reactions.
  const mass = massReport(bom);
  const g = catalog.limits.g_m_s2;
  const liftPts = liftingPoints(ctx);
  const liftLoad = (mass.transport_kg * g) / 1000;
  const liftR = rigidReactions(liftPts.map((p) => [p[0], p[1]] as const), liftLoad, mass.transport_cog_mm);
  const lift: LiftReactions = {
    method: 'rigid_equal_stiffness',
    load_kN: liftLoad,
    points: liftPts.map((p, i) => ({ id: 'ABCD'[i]!, position_mm: p, R_kN: liftR[i]! })),
    spread: spread(liftR),
    warn: spread(liftR) > catalog.limits.liftReactionSpreadWarn.value,
  };
  const ownSupported = new Set(
    config.attachments.filter((a) => idx.find('attachment_system', a.sku)?.ownSupports).map((a) => `att-${a.id}`),
  );
  const supLines = bom.filter((l) => l.assembly !== 'foundation' && !ownSupported.has(l.componentId));
  const supMass = supLines.reduce((s, l) => s + l.mass_kg, 0);
  const supCog = weightedCentre(supLines.map((l) => ({ m: l.mass_kg, c: l.cog_mm })));
  const supPts = supportPoints(config, idx, geo);
  const supR = rigidReactions(supPts.map((p) => [p[0], p[1]] as const), (supMass * g) / 1000, supCog);
  const supports: SupportLoads = {
    foundation: config.foundation,
    method: 'rigid_equal_stiffness',
    load_kN: (supMass * g) / 1000,
    cog_mm: supCog,
    points: supPts.map((p, i) => ({ id: `P${i + 1}`, position_mm: p, R_kN: supR[i]! })),
  };

  // Transport: fixed attachments widen the module.
  const fixedAtt = config.attachments
    .filter((a) => idx.find('attachment_system', a.sku)?.demountable === false)
    .map((a) => results.get(`att-${a.id}`)!.geometry);
  const transport = transportReport(ctx, mass, bom, fixedAtt);

  // Sauna report.
  const sf = preFacts;
  const num = (k: string) => (typeof sf[k] === 'number' ? (sf[k] as number) : 0);
  const sauna: SaunaReport = {
    innerVolume_m3: num('sauna.innerVolume_m3'),
    glassArea_m2: num('sauna.glassArea_m2'),
    uninsulatedArea_m2: num('sauna.uninsulatedArea_m2'),
    eqVolume_m3: num('sauna.eqVolume_m3'),
    suitableHeaters: suitableHeaters(ctx, num('sauna.eqVolume_m3'), num('sauna.clearHeight_mm')).map((h) => h.sku),
    cabinClearHeight_mm: num('sauna.clearHeight_mm'),
    topBench_mm: num('sauna.topBench_mm'),
    topBenchToCeiling_mm: num('sauna.topBenchToCeiling_mm'),
  };
  const el = electricalFor(ctx);
  if (el) sauna.electrical = el;

  const price = priceBreakdown(config, catalog.rates, bom, transport);

  const facts: Facts = {
    ...preFacts,
    'mass.empty_kg': round(mass.empty_kg, 2),
    'mass.transport_kg': round(mass.transport_kg, 2),
    'lift.spread': round(lift.spread, 4),
    'transport.width_mm': round(transport.width_mm, 1),
    'transport.heightOnVehicle_mm': round(transport.heightOnVehicle_mm, 1),
    'transport.oversize': transport.oversize,
  };
  const violations = runCheckRules(catalog.rules, ctx, facts, registry);

  return {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    config,
    catalogVersion: catalog.version,
    geometry: geo,
    auto: ctx.auto,
    slots,
    scene,
    bom,
    bomRows,
    penetrations,
    mass,
    lift,
    supports,
    transport,
    sauna,
    price,
    facts,
    violations,
    submittable: !violations.some((v) => v.level === 'error'),
  };
}
