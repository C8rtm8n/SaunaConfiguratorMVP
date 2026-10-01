import type { SaunaConfig } from '../../model/config.js';
import type { ProductLinePack } from '../../model/productLine.js';
import type { Facts } from '../../model/rules.js';
import { round } from '../../util/math.js';
import { buildBenchSupports, buildBenches, buildChimney, buildHeater, buildLighting, buildVentilation } from './builders.js';
import { SAUNA_AUTOS, SAUNA_CHECKS, SAUNA_FIXES } from './checks.js';
import { eqVolume, saunaLayout } from './layout.js';

export const SAUNA_PACK: ProductLinePack<SaunaConfig> = {
  id: 'sauna',
  zoneTypes: ['sauna', 'changing'],
  components: () => [
    { id: 'heater', builder: 'sauna.heater', params: {} },
    { id: 'benches', builder: 'sauna.benches', params: {} },
    { id: 'lighting', builder: 'sauna.lighting', params: {} },
  ],
  builders: {
    'sauna.heater': buildHeater,
    'sauna.benches': buildBenches,
    'sauna.benchSupports': buildBenchSupports,
    'sauna.lighting': buildLighting,
    'sauna.chimney': buildChimney,
    'sauna.ventilation': buildVentilation,
  },
  facts(config, ctx): Facts {
    const h = ctx.catalog.find('heater', config.sauna.heater.sku);
    const l = saunaLayout(ctx);
    const f: Record<string, string | number | boolean | null> = {
      'heater.fuel': h?.fuel ?? null,
      'heater.power_kw': h?.power_kw ?? null,
      'heater.volume_min_m3': h?.volume_min_m3 ?? null,
      'heater.volume_max_m3': h?.volume_max_m3 ?? null,
      'heater.minCabinHeight_mm': h?.minCabinHeight_mm ?? null,
      'sauna.innerVolume_m3': null,
      'sauna.glassArea_m2': null,
      'sauna.uninsulatedArea_m2': null,
      'sauna.eqVolume_m3': null,
      'sauna.clearHeight_mm': null,
      'sauna.length_mm': null,
      'sauna.topBench_mm': null,
      'sauna.topBenchToCeiling_mm': null,
    };
    if (l) {
      f['sauna.innerVolume_m3'] = round(l.volume_m3, 3);
      f['sauna.glassArea_m2'] = round(l.glassArea_m2, 3);
      f['sauna.uninsulatedArea_m2'] = round(l.uninsulatedArea_m2, 3);
      f['sauna.eqVolume_m3'] = round(eqVolume(ctx, l), 3);
      f['sauna.clearHeight_mm'] = round(l.ceiling_mm - l.floor_mm, 1);
      f['sauna.length_mm'] = round(l.room.box.max[0] - l.room.box.min[0], 1);
      if (l.bench) {
        f['sauna.topBench_mm'] = l.bench.top_mm;
        f['sauna.topBenchToCeiling_mm'] = round(l.ceiling_mm - l.floor_mm - l.bench.top_mm, 1);
      }
    }
    return f;
  },
  checks: SAUNA_CHECKS,
  autos: SAUNA_AUTOS,
  fixes: SAUNA_FIXES,
};
