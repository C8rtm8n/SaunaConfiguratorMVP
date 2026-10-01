import { CONFIG_SCHEMA_VERSION, type SaunaConfig } from '../model/config.js';

/**
 * The 3 acceptance reference configs. SKUs refer to the demo seed catalog
 * (created in M1 as a test fixture, moved to seed in M5).
 * Custom module height is fixed at 2 700 mm (Q3).
 */

/** REF-1: custom 2.3 × 4.2 m, one sauna zone, wood-burning heater. */
export const REF1_CUSTOM_4200_WOOD: SaunaConfig = {
  id: 'ref-1',
  revision: 1,
  tenantId: 'demo',
  catalogVersion: 'demo-1',
  schemaVersion: CONFIG_SCHEMA_VERSION,
  productLine: 'sauna',
  module: { type: 'custom_frame', L_mm: 4200, W_mm: 2300, H_mm: 2700, grid_mm: 600 },
  cladding: { exterior: 'CLAD-THERMO-26x92', orientation: 'vertical', roof: 'ROOF-TRAPEZ' },
  openings: [
    { id: 'door-1', wall: 'S', slotFrom: 3, slotTo: 4, type: 'door', sku: 'DOOR-GLASS-700x1900', door: { hinge: 'right', swing: 'out' } },
    { id: 'win-1', wall: 'E', slotFrom: 1, slotTo: 2, type: 'window', sku: 'WIN-900x600' },
  ],
  zones: [{ id: 'z-sauna', type: 'sauna', from_mm: 0, to_mm: 4200 }],
  sauna: {
    zoneId: 'z-sauna',
    heater: { sku: 'HEATER-WOOD-A', wall: 'W', along_mm: 1150 },
    benches: { system: 'BENCH-ABACHI', layout: 'L', levels: 2, wall: 'E', returnWall: 'N' },
    lighting: [{ sku: 'LED-STRIP-SAUNA', mount: 'under_bench', qty: 2 }],
    interiorCladding: 'INT-ASPEN-15',
  },
  attachments: [],
  foundation: 'pads',
};

/** REF-2: custom 2.3 × 6 m, sauna + changing room, front terrace, electric heater. */
export const REF2_CUSTOM_6000_TWO_ZONES: SaunaConfig = {
  id: 'ref-2',
  revision: 1,
  tenantId: 'demo',
  catalogVersion: 'demo-1',
  schemaVersion: CONFIG_SCHEMA_VERSION,
  productLine: 'sauna',
  module: { type: 'custom_frame', L_mm: 6000, W_mm: 2300, H_mm: 2700, grid_mm: 600 },
  cladding: { exterior: 'CLAD-YAKISUGI', orientation: 'horizontal', roof: 'ROOF-TRAPEZ' },
  openings: [
    { id: 'pano-1', wall: 'S', slotFrom: 1, slotTo: 4, type: 'panorama', sku: 'WIN-PANO-2400x1200' },
    { id: 'door-ext', wall: 'E', slotFrom: 0, slotTo: 1, type: 'door', sku: 'DOOR-GLASS-700x1900', door: { hinge: 'left', swing: 'out' } },
    { id: 'door-sauna', wall: 'P1', slotFrom: 0, slotTo: 1, type: 'door', sku: 'DOOR-GLASS-700x1900', door: { hinge: 'right', swing: 'out' } },
  ],
  zones: [
    { id: 'z-sauna', type: 'sauna', from_mm: 0, to_mm: 3600 },
    { id: 'z-changing', type: 'changing', from_mm: 3600, to_mm: 6000 },
  ],
  sauna: {
    zoneId: 'z-sauna',
    heater: { sku: 'HEATER-EL-B', wall: 'N', along_mm: 2600 },
    benches: { system: 'BENCH-ABACHI', layout: 'straight', levels: 3, wall: 'W' },
    lighting: [{ sku: 'LED-STRIP-SAUNA', mount: 'backrest', qty: 1 }],
    interiorCladding: 'INT-THERMO-ASPEN-15',
  },
  attachments: [
    { id: 'terrace-1', type: 'terrace', wall: 'E', depth_mm: 1800, sku: 'TERRACE-STD' },
    { id: 'rail-1', type: 'railing', attachTo: 'terrace-1', edges: ['N', 'S'], sku: 'RAILING-STD' },
    { id: 'stairs-1', type: 'stairs', attachTo: 'terrace-1', edge: 'E', slot: 1, sku: 'STAIRS-3' },
  ],
  foundation: 'screws',
};

/** REF-3: ISO 20′ HC, glazed end wall, electric heater. */
export const REF3_ISO20HC_GLASS_FRONT: SaunaConfig = {
  id: 'ref-3',
  revision: 1,
  tenantId: 'demo',
  catalogVersion: 'demo-1',
  schemaVersion: CONFIG_SCHEMA_VERSION,
  productLine: 'sauna',
  module: { type: 'iso_20hc', L_mm: 6058, W_mm: 2438, H_mm: 2896, grid_mm: 600 },
  cladding: { exterior: 'CLAD-THERMO-26x92', orientation: 'vertical', roof: 'ROOF-TRAPEZ' },
  openings: [
    { id: 'front', wall: 'E', slotFrom: 0, slotTo: 3, type: 'glass_front', sku: 'GLASS-FRONT-ISO' },
    { id: 'door-1', wall: 'S', slotFrom: 1, slotTo: 2, type: 'door', sku: 'DOOR-GLASS-700x1900', door: { hinge: 'left', swing: 'out' } },
    { id: 'door-sauna', wall: 'P1', slotFrom: 0, slotTo: 1, type: 'door', sku: 'DOOR-GLASS-700x1900', door: { hinge: 'right', swing: 'out' } },
  ],
  zones: [
    { id: 'z-changing', type: 'changing', from_mm: 0, to_mm: 1800 },
    { id: 'z-sauna', type: 'sauna', from_mm: 1800, to_mm: 6058 },
  ],
  sauna: {
    zoneId: 'z-sauna',
    heater: { sku: 'HEATER-EL-B', wall: 'S', along_mm: 3200 },
    benches: { system: 'BENCH-ABACHI', layout: 'straight', levels: 2, wall: 'N', from_mm: 2500 },
    lighting: [{ sku: 'LED-STRIP-SAUNA', mount: 'under_bench', qty: 1 }],
    interiorCladding: 'INT-ASPEN-15',
  },
  attachments: [],
  foundation: 'beams',
};

export const REFERENCE_CONFIGS = {
  'REF-1 – custom 2,3 × 4,2 m, kamna na dřevo': REF1_CUSTOM_4200_WOOD,
  'REF-2 – custom 2,3 × 6 m, 2 zóny, terasa': REF2_CUSTOM_6000_TWO_ZONES,
  'REF-3 – ISO 20′ HC, prosklené čelo': REF3_ISO20HC_GLASS_FRONT,
} as const;
