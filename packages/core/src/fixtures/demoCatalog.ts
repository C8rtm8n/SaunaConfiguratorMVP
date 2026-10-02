import type { Catalog, Source } from '../model/catalog.js';
import { DEFAULT_RULES } from '../rules/defaultRules.js';

/**
 * Demo tenant "Demo Sauny s.r.o." – test fixture for M1, moved to seed in M5.
 * Prices are demo values. Everything not taken from a standard is marked
 * `placeholder: true` and must be verified by the manufacturer.
 */

const PH = (ref: string): Source => ({ ref, placeholder: true });
const EN10219: Source = { ref: 'EN 10219-2, tab. B.2 (nominální hmotnost a povrch)' };
const EN10279: Source = { ref: 'EN 10279 / DIN 1026-1 (UPN 120)' };
const EN10056: Source = { ref: 'EN 10056-1 (L 50×5)' };
// TODO: ověřit v manuálu výrobce – all heater parameters below are placeholders.
const HEATER_PH = PH('TODO: ověřit v manuálu výrobce kamen – zástupné hodnoty');

export const DEMO_CATALOG: Catalog = {
  tenantId: 'demo',
  version: 'demo-1',
  pricing: 'cost',
  modules: {
    custom_frame: { length_mm: { min: 3600, max: 6000, step: 600 }, widths_mm: [2300, 2500], height_mm: 2700, grids_mm: [600] },
    iso_20hc: { container: 'CONT-20HC', grids_mm: [600] },
  },

  steel: [
    {
      kind: 'steel', sku: 'STEEL-S235', name: { cs: 'Ocel S235JRH', de: 'Stahl S235JRH', en: 'Steel S235JRH' }, active: true,
      grade: 'S235JRH', density_kg_m3: 7850, cost_per_kg: 32, coating_cost_per_m2: 380, coating: 'žárový zinek + PU nátěr',
      source: PH('ceny: demo'),
    },
  ],

  profiles: [
    { kind: 'steel_profile', sku: 'PRF-RHS100x100x4', name: { cs: 'RHS 100×100×4' }, active: true, material: 'STEEL-S235', designation: 'RHS 100×100×4', section: { shape: 'RHS', h: 100, b: 100, t: 4 }, mass_kg_per_m: 11.7, surface_m2_per_m: 0.383, waste: 0.05, source: EN10219 },
    { kind: 'steel_profile', sku: 'PRF-RHS80x80x3', name: { cs: 'RHS 80×80×3' }, active: true, material: 'STEEL-S235', designation: 'RHS 80×80×3', section: { shape: 'RHS', h: 80, b: 80, t: 3 }, mass_kg_per_m: 7.07, surface_m2_per_m: 0.309, waste: 0.05, source: EN10219 },
    { kind: 'steel_profile', sku: 'PRF-RHS60x40x3', name: { cs: 'RHS 60×40×3' }, active: true, material: 'STEEL-S235', designation: 'RHS 60×40×3', section: { shape: 'RHS', h: 60, b: 40, t: 3 }, mass_kg_per_m: 4.25, surface_m2_per_m: 0.192, waste: 0.05, source: EN10219 },
    { kind: 'steel_profile', sku: 'PRF-U120', name: { cs: 'U 120 (UPN)' }, active: true, material: 'STEEL-S235', designation: 'UPN 120', section: { shape: 'U', h: 120, b: 55, tw: 7, tf: 9 }, mass_kg_per_m: 13.4, surface_m2_per_m: 0.434, waste: 0.05, source: EN10279 },
    { kind: 'steel_profile', sku: 'PRF-L50x5', name: { cs: 'L 50×5' }, active: true, material: 'STEEL-S235', designation: 'L 50×50×5', section: { shape: 'L', a: 50, b: 50, t: 5 }, mass_kg_per_m: 3.77, surface_m2_per_m: 0.194, waste: 0.05, source: EN10056 },
  ],

  timber: [
    { kind: 'timber', sku: 'TIM-BATTEN-25x50', name: { cs: 'Lať smrk 25×50' }, active: true, species: 'smrk', b_mm: 50, h_mm: 25, density_kg_m3: 450, cost_per_m: 18, waste: 0.1, source: PH('hustota smrk sušený ~450 kg/m³') },
    { kind: 'timber', sku: 'TIM-BATTEN-50x50', name: { cs: 'Lať smrk 50×50' }, active: true, species: 'smrk', b_mm: 50, h_mm: 50, density_kg_m3: 450, cost_per_m: 32, waste: 0.1, source: PH('hustota smrk sušený ~450 kg/m³') },
    { kind: 'timber', sku: 'TIM-KVH-45x95', name: { cs: 'KVH 45×95' }, active: true, species: 'smrk KVH', b_mm: 45, h_mm: 95, density_kg_m3: 450, cost_per_m: 58, waste: 0.08, source: PH('hustota KVH ~450 kg/m³') },
    { kind: 'timber', sku: 'TIM-SUPPORT-45x70', name: { cs: 'Podpěra lavice osika 45×70' }, active: true, species: 'osika', b_mm: 45, h_mm: 70, density_kg_m3: 450, cost_per_m: 95, waste: 0.1, source: PH('hustota osika ~450 kg/m³') },
  ],

  panels: [
    { kind: 'panel', sku: 'CLAD-THERMO-26x92', name: { cs: 'Thermowood borovice 26×92 rhombus', de: 'Thermoholz Kiefer 26×92 Rhombus' }, active: true, role: 'exterior_cladding', material: 'thermowood borovice', thickness_mm: 26, mass_kg_per_m2: 10.0, cost_per_m2: 690, install_h_per_m2: 0.6, waste: 0.12, combustible: true, board: { width_mm: 92, coverWidth_mm: 100 }, appearance: 'thermowood', source: PH('hustota thermowood ~420 kg/m³, rhombus s mezerou') },
    { kind: 'panel', sku: 'CLAD-YAKISUGI', name: { cs: 'Yakisugi (opálené dřevo) 21×125', de: 'Yakisugi 21×125' }, active: true, role: 'exterior_cladding', material: 'opálený smrk', thickness_mm: 21, mass_kg_per_m2: 9.5, cost_per_m2: 1450, install_h_per_m2: 0.7, waste: 0.12, combustible: true, board: { width_mm: 125, coverWidth_mm: 130 }, appearance: 'yakisugi', source: PH('hustota ~450 kg/m³') },
    { kind: 'panel', sku: 'CLAD-TRAPEZ-T18', name: { cs: 'Trapézový plech T18 0,5 mm', de: 'Trapezblech T18' }, active: true, role: 'exterior_cladding', material: 'ocelový plech Pz + lak', thickness_mm: 18, mass_kg_per_m2: 4.6, cost_per_m2: 320, install_h_per_m2: 0.35, waste: 0.08, combustible: false, appearance: 'trapez-anthracite', source: PH('katalog dodavatele') },
    { kind: 'panel', sku: 'ROOF-TRAPEZ', name: { cs: 'Střešní trapéz T35 0,6 mm', de: 'Dachtrapez T35' }, active: true, role: 'roof_covering', material: 'ocelový plech Pz + lak', thickness_mm: 35, mass_kg_per_m2: 5.8, cost_per_m2: 380, install_h_per_m2: 0.4, waste: 0.08, combustible: false, appearance: 'trapez-anthracite', source: PH('katalog dodavatele') },
    { kind: 'panel', sku: 'INT-ASPEN-15', name: { cs: 'Osika SHP 15×90', de: 'Espe 15×90' }, active: true, role: 'interior_cladding', material: 'osika', thickness_mm: 15, mass_kg_per_m2: 6.8, cost_per_m2: 650, install_h_per_m2: 0.7, waste: 0.1, combustible: true, board: { width_mm: 90, coverWidth_mm: 85 }, appearance: 'aspen', source: PH('hustota osika ~450 kg/m³') },
    { kind: 'panel', sku: 'INT-THERMO-ASPEN-15', name: { cs: 'Thermo-osika SHP 15×90', de: 'Thermo-Espe 15×90' }, active: true, role: 'interior_cladding', material: 'thermo-osika', thickness_mm: 15, mass_kg_per_m2: 6.0, cost_per_m2: 890, install_h_per_m2: 0.7, waste: 0.1, combustible: true, board: { width_mm: 90, coverWidth_mm: 85 }, appearance: 'thermo-aspen', source: PH('hustota ~400 kg/m³') },
    { kind: 'panel', sku: 'BENCH-BOARD-ABACHI-28', name: { cs: 'Lavicové prkno abachi 28×90', de: 'Abachi Bankbrett 28×90' }, active: true, role: 'bench_board', material: 'abachi', thickness_mm: 28, mass_kg_per_m2: 9.6, cost_per_m2: 1600, install_h_per_m2: 0, waste: 0.1, combustible: true, board: { width_mm: 90, coverWidth_mm: 100 }, appearance: 'abachi', source: PH('hustota abachi ~380 kg/m³, 90 % krytí') },
    { kind: 'panel', sku: 'INS-MW-50', name: { cs: 'Minerální vata 50 mm' }, active: true, role: 'insulation', material: 'minerální vata', thickness_mm: 50, mass_kg_per_m2: 1.75, cost_per_m2: 85, install_h_per_m2: 0.1, waste: 0.05, combustible: false, appearance: 'insulation', source: PH('35 kg/m³') },
    { kind: 'panel', sku: 'INS-MW-80', name: { cs: 'Minerální vata 80 mm' }, active: true, role: 'insulation', material: 'minerální vata', thickness_mm: 80, mass_kg_per_m2: 2.8, cost_per_m2: 125, install_h_per_m2: 0.1, waste: 0.05, combustible: false, appearance: 'insulation', source: PH('35 kg/m³') },
    { kind: 'panel', sku: 'INS-MW-100', name: { cs: 'Minerální vata 100 mm' }, active: true, role: 'insulation', material: 'minerální vata', thickness_mm: 100, mass_kg_per_m2: 3.5, cost_per_m2: 150, install_h_per_m2: 0.1, waste: 0.05, combustible: false, appearance: 'insulation', source: PH('35 kg/m³') },
    { kind: 'panel', sku: 'MEM-DIFF', name: { cs: 'Difuzní fólie' }, active: true, role: 'membrane', material: 'PP fólie', thickness_mm: 1, mass_kg_per_m2: 0.15, cost_per_m2: 35, install_h_per_m2: 0.05, waste: 0.1, combustible: true, appearance: 'membrane', source: PH('katalog dodavatele') },
    { kind: 'panel', sku: 'VB-ALU', name: { cs: 'Parozábrana Al (saunová)' }, active: true, role: 'vapour_barrier', material: 'Al fólie', thickness_mm: 1, mass_kg_per_m2: 0.2, cost_per_m2: 55, install_h_per_m2: 0.08, waste: 0.1, combustible: false, appearance: 'alu-foil', source: PH('katalog dodavatele') },
    { kind: 'panel', sku: 'SHEATH-OSB-22', name: { cs: 'OSB/3 22 mm' }, active: true, role: 'sheathing', material: 'OSB/3', thickness_mm: 22, mass_kg_per_m2: 13.6, cost_per_m2: 420, install_h_per_m2: 0.25, waste: 0.08, combustible: true, appearance: 'osb', source: PH('620 kg/m³') },
    { kind: 'panel', sku: 'FLOOR-THERMO-28', name: { cs: 'Podlaha thermowood 28 mm' }, active: true, role: 'floor', material: 'thermowood borovice', thickness_mm: 28, mass_kg_per_m2: 11.8, cost_per_m2: 990, install_h_per_m2: 0.5, waste: 0.1, combustible: true, appearance: 'thermowood-floor', source: PH('420 kg/m³') },
    { kind: 'panel', sku: 'BOTTOM-SHEET', name: { cs: 'Spodní krycí plech 0,5 mm' }, active: true, role: 'sheathing', material: 'ocelový plech Pz', thickness_mm: 1, mass_kg_per_m2: 4.6, cost_per_m2: 250, install_h_per_m2: 0.2, waste: 0.08, combustible: false, appearance: 'steel-galv', source: PH('katalog dodavatele') },
  ],

  layups: [
    {
      kind: 'layup', sku: 'LAY-C-WALL', name: { cs: 'Stěna – custom rám' }, active: true, surface: 'wall', moduleTypes: ['custom_frame'], insulated: true,
      source: PH('typická skladba saunové stěny, návrh – ověřit'),
      layers: [
        { kind: 'panel', sku: '$exterior', thickness_mm: 26 },
        { kind: 'members', sku: 'TIM-BATTEN-25x50', thickness_mm: 25, spacing_mm: 600 },
        { kind: 'panel', sku: 'MEM-DIFF', thickness_mm: 1 },
        { kind: 'structure', thickness_mm: 80, fill: 'INS-MW-80' },
        { kind: 'members', sku: 'TIM-BATTEN-50x50', thickness_mm: 50, spacing_mm: 600, fill: 'INS-MW-50' },
        { kind: 'panel', sku: 'VB-ALU', thickness_mm: 1 },
        { kind: 'members', sku: 'TIM-BATTEN-25x50', thickness_mm: 25, spacing_mm: 600 },
        { kind: 'panel', sku: '$interior', thickness_mm: 15 },
      ],
    },
    {
      kind: 'layup', sku: 'LAY-C-ROOF', name: { cs: 'Střecha – custom rám' }, active: true, surface: 'roof', moduleTypes: ['custom_frame'], insulated: true,
      source: PH('návrh – ověřit'),
      layers: [
        { kind: 'panel', sku: '$roof', thickness_mm: 35 },
        { kind: 'members', sku: 'TIM-BATTEN-50x50', thickness_mm: 50, spacing_mm: 600 },
        { kind: 'panel', sku: 'MEM-DIFF', thickness_mm: 1 },
        { kind: 'panel', sku: 'SHEATH-OSB-22', thickness_mm: 22 },
        { kind: 'structure', thickness_mm: 80, fill: 'INS-MW-80' },
        { kind: 'members', sku: 'TIM-BATTEN-50x50', thickness_mm: 50, spacing_mm: 600, fill: 'INS-MW-50' },
        { kind: 'panel', sku: 'VB-ALU', thickness_mm: 1 },
        { kind: 'members', sku: 'TIM-BATTEN-25x50', thickness_mm: 25, spacing_mm: 600 },
        { kind: 'panel', sku: '$interior', thickness_mm: 15 },
      ],
    },
    {
      kind: 'layup', sku: 'LAY-C-FLOOR', name: { cs: 'Podlaha – custom rám' }, active: true, surface: 'floor', moduleTypes: ['custom_frame'], insulated: true,
      source: PH('návrh – ověřit'),
      layers: [
        { kind: 'panel', sku: 'BOTTOM-SHEET', thickness_mm: 1 },
        { kind: 'structure', thickness_mm: 100, fill: 'INS-MW-100' },
        { kind: 'panel', sku: 'SHEATH-OSB-22', thickness_mm: 22 },
        { kind: 'panel', sku: 'FLOOR-THERMO-28', thickness_mm: 28 },
      ],
    },
    {
      kind: 'layup', sku: 'LAY-PARTITION', name: { cs: 'Příčka sauna / převlékárna' }, active: true, surface: 'partition', moduleTypes: ['custom_frame', 'iso_20hc'], insulated: true,
      source: PH('návrh – ověřit'),
      layers: [
        { kind: 'panel', sku: '$interior', thickness_mm: 15 },
        { kind: 'members', sku: 'TIM-BATTEN-25x50', thickness_mm: 25, spacing_mm: 600 },
        { kind: 'panel', sku: 'VB-ALU', thickness_mm: 1 },
        { kind: 'members', sku: 'TIM-KVH-45x95', thickness_mm: 95, spacing_mm: 600, fill: 'INS-MW-100' },
        { kind: 'panel', sku: '$interior', thickness_mm: 15 },
      ],
    },
    {
      kind: 'layup', sku: 'LAY-I-WALL', name: { cs: 'Stěna – ISO kontejner' }, active: true, surface: 'wall', moduleTypes: ['iso_20hc'], insulated: true,
      source: PH('návrh – ověřit; tloušťka stěny kontejneru (2438−2352)/2 = 43 mm'),
      layers: [
        { kind: 'panel', sku: '$exterior', thickness_mm: 26 },
        { kind: 'members', sku: 'TIM-BATTEN-25x50', thickness_mm: 25, spacing_mm: 600 },
        { kind: 'panel', sku: 'MEM-DIFF', thickness_mm: 1 },
        { kind: 'structure', thickness_mm: 43 },
        { kind: 'members', sku: 'TIM-BATTEN-50x50', thickness_mm: 50, spacing_mm: 600, fill: 'INS-MW-50' },
        { kind: 'panel', sku: 'VB-ALU', thickness_mm: 1 },
        { kind: 'members', sku: 'TIM-BATTEN-25x50', thickness_mm: 25, spacing_mm: 600 },
        { kind: 'panel', sku: '$interior', thickness_mm: 15 },
      ],
    },
    {
      kind: 'layup', sku: 'LAY-I-ROOF', name: { cs: 'Střecha – ISO kontejner' }, active: true, surface: 'roof', moduleTypes: ['iso_20hc'], insulated: true,
      source: PH('návrh – ověřit'),
      layers: [
        { kind: 'panel', sku: '$roof', thickness_mm: 35 },
        { kind: 'members', sku: 'TIM-BATTEN-50x50', thickness_mm: 50, spacing_mm: 600 },
        { kind: 'panel', sku: 'MEM-DIFF', thickness_mm: 1 },
        { kind: 'structure', thickness_mm: 40 },
        { kind: 'members', sku: 'TIM-BATTEN-50x50', thickness_mm: 50, spacing_mm: 600, fill: 'INS-MW-50' },
        { kind: 'panel', sku: 'VB-ALU', thickness_mm: 1 },
        { kind: 'members', sku: 'TIM-BATTEN-25x50', thickness_mm: 25, spacing_mm: 600 },
        { kind: 'panel', sku: '$interior', thickness_mm: 15 },
      ],
    },
    {
      kind: 'layup', sku: 'LAY-I-FLOOR', name: { cs: 'Podlaha – ISO kontejner' }, active: true, surface: 'floor', moduleTypes: ['iso_20hc'], insulated: true,
      source: PH('návrh – ověřit; podlaha kontejneru vč. původní překližky 158 mm'),
      layers: [
        { kind: 'structure', thickness_mm: 158 },
        { kind: 'members', sku: 'TIM-BATTEN-50x50', thickness_mm: 50, spacing_mm: 600, fill: 'INS-MW-50' },
        { kind: 'panel', sku: 'SHEATH-OSB-22', thickness_mm: 22 },
        { kind: 'panel', sku: 'FLOOR-THERMO-28', thickness_mm: 28 },
      ],
    },
  ],

  frameRecipes: [
    {
      kind: 'frame_recipe', sku: 'FR-CUSTOM', name: { cs: 'Svařovaný rám – custom' }, active: true, moduleType: 'custom_frame',
      source: PH('topologie rámu – návrh, ověřit statikem'),
      members: {
        base_perimeter: { profile: 'PRF-RHS100x100x4' },
        base_crossmember: { profile: 'PRF-RHS60x40x3', maxSpacing_mm: 600 },
        column_corner: { profile: 'PRF-RHS80x80x3' },
        column_grid: { profile: 'PRF-RHS80x80x3', maxSpacing_mm: 2400 },
        top_perimeter: { profile: 'PRF-RHS80x80x3' },
        roof_beam: { profile: 'PRF-RHS60x40x3', maxSpacing_mm: 600 },
        opening_reinforcement: { profile: 'PRF-RHS60x40x3' },
      },
      liftingLug: 'LUG-20',
      welding_h_per_kg: 0.06,
      layups: { wall: 'LAY-C-WALL', roof: 'LAY-C-ROOF', floor: 'LAY-C-FLOOR', partition: 'LAY-PARTITION' },
    },
    {
      kind: 'frame_recipe', sku: 'FR-ISO20HC', name: { cs: 'Úpravy ISO 20′ HC' }, active: true, moduleType: 'iso_20hc',
      source: PH('návrh – ověřit'),
      members: { opening_reinforcement: { profile: 'PRF-L50x5' } },
      welding_h_per_kg: 0.1,
      layups: { wall: 'LAY-I-WALL', roof: 'LAY-I-ROOF', floor: 'LAY-I-FLOOR', partition: 'LAY-PARTITION' },
    },
  ],

  containers: [
    {
      kind: 'container', sku: 'CONT-20HC', name: { cs: 'ISO kontejner 20′ HC (použitý, cargo-worthy)' }, active: true, iso: '20HC',
      L_mm: 6058, W_mm: 2438, H_mm: 2896, tare_kg: 2250, cog_mm: [3029, 1219, 1150], cost: 95000,
      cornerPost_mm: 150, wallSheet_kg_per_m2: 18, cutting_h_per_m: 0.5, doorEnd: 'E', doors_kg: 280,
      source: PH('rozměry ISO 668; tara, těžiště, hmotnost dveří a plechu = zástupné hodnoty – ověřit na CSC štítku'),
    },
  ],

  foundations: [
    { kind: 'foundation', sku: 'FND-PADS', name: { cs: 'Betonové patky', de: 'Betonfundamente' }, active: true, type: 'pads', pointSku: 'PAD-CONCRETE', maxSpacing_mm: 2000, source: PH('max. rozteč podpor – ověřit statikem') },
    { kind: 'foundation', sku: 'FND-SCREWS', name: { cs: 'Zemní vruty', de: 'Schraubfundamente' }, active: true, type: 'screws', pointSku: 'SCREW-76', maxSpacing_mm: 2000, source: PH('max. rozteč podpor – ověřit statikem') },
    { kind: 'foundation', sku: 'FND-BEAMS', name: { cs: 'Ocelové pražce U 120 na patkách', de: 'Stahlschwellen U 120' }, active: true, type: 'beams', pointSku: 'PAD-CONCRETE', maxSpacing_mm: 2000, beamProfile: 'PRF-U120', beamOverhang_mm: 150, source: PH('návrh – ověřit') },
  ],

  openings: [
    { kind: 'opening', sku: 'WIN-600x600', name: { cs: 'Okno 600×600', de: 'Fenster 600×600' }, active: true, type: 'window', width_mm: 600, height_mm: 600, sill_mm: 1000, slots: { 600: 1, 1200: 1 }, glassArea_m2: 0.3, mass_kg: 25, cost: 9500, install_h: 1.5, moduleTypes: ['custom_frame', 'iso_20hc'], source: PH('demo') },
    { kind: 'opening', sku: 'WIN-900x600', name: { cs: 'Okno 900×600', de: 'Fenster 900×600' }, active: true, type: 'window', width_mm: 900, height_mm: 600, sill_mm: 1000, slots: { 600: 2, 1200: 1 }, glassArea_m2: 0.45, mass_kg: 32, cost: 12500, install_h: 1.5, moduleTypes: ['custom_frame', 'iso_20hc'], source: PH('demo') },
    { kind: 'opening', sku: 'WIN-PANO-2400x1200', name: { cs: 'Panoramatické okno 2 400×1 200', de: 'Panoramafenster 2400×1200' }, active: true, type: 'panorama', width_mm: 2400, height_mm: 1200, sill_mm: 500, slots: { 600: 4, 1200: 2 }, glassArea_m2: 2.6, mass_kg: 110, cost: 48000, install_h: 4, moduleTypes: ['custom_frame', 'iso_20hc'], source: PH('demo') },
    { kind: 'opening', sku: 'GLASS-FRONT-CUSTOM', name: { cs: 'Prosklené čelo (custom)', de: 'Glasfront (custom)' }, active: true, type: 'glass_front', width_mm: 1900, height_mm: 2100, sill_mm: 0, slots: {}, fullWall: true, glassArea_m2: 3.6, mass_kg: 180, cost: 72000, install_h: 6, moduleTypes: ['custom_frame'], source: PH('demo') },
    { kind: 'opening', sku: 'GLASS-FRONT-ISO', name: { cs: 'Prosklené čelo ISO', de: 'Glasfront ISO' }, active: true, type: 'glass_front', width_mm: 2100, height_mm: 2300, sill_mm: 0, slots: {}, fullWall: true, glassArea_m2: 4.3, mass_kg: 220, cost: 85000, install_h: 8, moduleTypes: ['iso_20hc'], source: PH('demo') },
    { kind: 'opening', sku: 'DOOR-GLASS-700x1900', name: { cs: 'Celoskleněné dveře 700×1 900', de: 'Ganzglastür 700×1900' }, active: true, type: 'door', width_mm: 700, height_mm: 1900, sill_mm: 0, slots: { 600: 2, 1200: 1 }, clearWidth_mm: 620, glassArea_m2: 1.1, mass_kg: 45, cost: 14500, install_h: 2, moduleTypes: ['custom_frame', 'iso_20hc'], source: PH('světlá šířka – ověřit u dodavatele') },
    { kind: 'opening', sku: 'VENT-150', name: { cs: 'Větrací mřížka 150×150' }, active: true, type: 'vent', width_mm: 150, height_mm: 150, sill_mm: 200, slots: { 600: 1, 1200: 1 }, glassArea_m2: 0, mass_kg: 0.5, cost: 450, install_h: 0.3, moduleTypes: ['custom_frame', 'iso_20hc'], source: PH('demo') },
  ],

  heaters: [
    {
      kind: 'heater', sku: 'HEATER-WOOD-A', name: { cs: 'Kamna na dřevo 16 kW (placeholder)', de: 'Holzofen 16 kW (Platzhalter)' }, active: true,
      fuel: 'wood', power_kw: 16, volume_min_m3: 8, volume_max_m3: 20,
      clearance: { side_mm: 500, front_mm: 500, back_mm: 300, top_mm: 1000 },
      size: { w_mm: 400, d_mm: 520, h_mm: 760 }, mass_kg: 130, stones_kg: 60, minCabinHeight_mm: 2100, cost: 22000, install_h: 3,
      flue: { diameter_mm: 115, offset_mm: [0, 0], clearanceCombustible_mm: 100, chimneySku: 'CHIMNEY-SET-115', aboveRoof_mm: 1000 },
      source: HEATER_PH,
    },
    {
      kind: 'heater', sku: 'HEATER-WOOD-B', name: { cs: 'Kamna na dřevo 20 kW (placeholder)', de: 'Holzofen 20 kW (Platzhalter)' }, active: true,
      fuel: 'wood', power_kw: 20, volume_min_m3: 12, volume_max_m3: 28,
      clearance: { side_mm: 500, front_mm: 500, back_mm: 300, top_mm: 1100 },
      size: { w_mm: 450, d_mm: 600, h_mm: 800 }, mass_kg: 180, stones_kg: 90, minCabinHeight_mm: 2100, cost: 29000, install_h: 3,
      flue: { diameter_mm: 115, offset_mm: [0, 0], clearanceCombustible_mm: 100, chimneySku: 'CHIMNEY-SET-115', aboveRoof_mm: 1000 },
      source: HEATER_PH,
    },
    {
      kind: 'heater', sku: 'HEATER-EL-A', name: { cs: 'Elektrická kamna 9 kW (placeholder)', de: 'Elektroofen 9 kW (Platzhalter)' }, active: true,
      fuel: 'electric', power_kw: 9, volume_min_m3: 8, volume_max_m3: 14,
      clearance: { side_mm: 100, front_mm: 100, back_mm: 50, top_mm: 1150 },
      size: { w_mm: 430, d_mm: 300, h_mm: 650 }, mass_kg: 50, stones_kg: 25, minCabinHeight_mm: 1900, cost: 18000, install_h: 2,
      electrical: { voltage: 400, phases: 3 },
      source: HEATER_PH,
    },
    {
      kind: 'heater', sku: 'HEATER-EL-B', name: { cs: 'Elektrická kamna 18 kW (placeholder)', de: 'Elektroofen 18 kW (Platzhalter)' }, active: true,
      fuel: 'electric', power_kw: 18, volume_min_m3: 15, volume_max_m3: 30,
      clearance: { side_mm: 100, front_mm: 100, back_mm: 50, top_mm: 1150 },
      size: { w_mm: 500, d_mm: 400, h_mm: 750 }, mass_kg: 80, stones_kg: 45, minCabinHeight_mm: 2100, cost: 34000, install_h: 2.5,
      electrical: { voltage: 400, phases: 3 },
      source: HEATER_PH,
    },
  ],

  benchSystems: [
    {
      kind: 'bench_system', sku: 'BENCH-ABACHI', name: { cs: 'Lavice abachi', de: 'Saunabank Abachi' }, active: true,
      levels: [ { top_mm: 400, depth_mm: 400 }, { top_mm: 750, depth_mm: 450 }, { top_mm: 1100, depth_mm: 600 } ],
      board: 'BENCH-BOARD-ABACHI-28', support: 'TIM-SUPPORT-45x70', maxSpan_mm: 1500, defaultReturnLength_mm: 1200, assembly_h_per_m: 1.5,
      source: PH('výšky/hloubky úrovní – interní standard; max. rozpětí dle zadání [1 500]'),
    },
  ],

  purchased: [
    { kind: 'purchased', sku: 'LED-STRIP-SAUNA', name: { cs: 'LED pásek saunový 2 m', de: 'LED-Streifen Sauna 2 m' }, active: true, category: 'light', mass_kg: 0.5, cost: 1800, install_h: 1, demountable: false, size_mm: [2000, 20, 10], source: PH('demo') },
    { kind: 'purchased', sku: 'LIGHT-CEILING', name: { cs: 'Stropní saunové svítidlo', de: 'Saunadeckenleuchte' }, active: true, category: 'light', mass_kg: 0.8, cost: 1500, install_h: 0.8, demountable: false, size_mm: [150, 150, 80], source: PH('demo') },
    { kind: 'purchased', sku: 'LUG-20', name: { cs: 'Závěsné oko 2 t', de: 'Anschlagöse 2 t' }, active: true, category: 'lifting', mass_kg: 2.5, cost: 350, install_h: 0.3, demountable: false, size_mm: [60, 20, 80], source: PH('demo') },
    { kind: 'purchased', sku: 'CHIMNEY-SET-115', name: { cs: 'Komínová sestava Ø115 izolovaná (vč. průchodky střechou)', de: 'Kaminset Ø115' }, active: true, category: 'chimney', mass_kg: 35, cost: 16000, install_h: 3, demountable: true, source: PH('demo') },
    { kind: 'purchased', sku: 'VENT-GRILLE-100', name: { cs: 'Větrací mřížka Ø100', de: 'Lüftungsgitter Ø100' }, active: true, category: 'vent', mass_kg: 0.3, cost: 350, install_h: 0.3, demountable: false, source: PH('demo') },
    { kind: 'purchased', sku: 'PAD-CONCRETE', name: { cs: 'Betonová patka 400×400', de: 'Betonfundament 400×400' }, active: true, category: 'foundation', mass_kg: 45, cost: 450, install_h: 0.5, demountable: true, size_mm: [400, 400, 200], source: PH('demo') },
    { kind: 'purchased', sku: 'SCREW-76', name: { cs: 'Zemní vrut Ø76×1 600', de: 'Schraubfundament Ø76×1600' }, active: true, category: 'foundation', mass_kg: 9, cost: 1400, install_h: 0.5, demountable: true, size_mm: [76, 76, 1600], source: PH('demo') },
  ],

  attachmentSystems: [
    { kind: 'attachment_system', sku: 'TERRACE-STD', name: { cs: 'Terasa thermowood na ocelovém roštu', de: 'Terrasse Thermoholz' }, active: true, type: 'terrace', allowedDepths_mm: [1200, 1800, 2400], basis: 'm2', mass_kg_per_unit: 45, cost_per_unit: 4200, install_h_per_unit: 1.5, demountable: true, thickness_mm: 150, ownSupports: true, appearance: 'thermowood-deck', source: PH('demo') },
    { kind: 'attachment_system', sku: 'OVERHANG-STD', name: { cs: 'Přesah střechy', de: 'Dachüberstand' }, active: true, type: 'roof_overhang', allowedDepths_mm: [600, 1200], basis: 'm2', mass_kg_per_unit: 25, cost_per_unit: 3500, install_h_per_unit: 1.2, demountable: true, thickness_mm: 120, ownSupports: false, appearance: 'trapez-anthracite', source: PH('demo') },
    { kind: 'attachment_system', sku: 'STAIRS-3', name: { cs: 'Schody 3 stupně', de: 'Treppe 3 Stufen' }, active: true, type: 'stairs', basis: 'ks', mass_kg_per_unit: 60, cost_per_unit: 9000, install_h_per_unit: 3, demountable: true, width_mm: 1000, thickness_mm: 900, ownSupports: true, appearance: 'thermowood-deck', source: PH('demo') },
    { kind: 'attachment_system', sku: 'RAILING-STD', name: { cs: 'Zábradlí ocel + dřevo', de: 'Geländer' }, active: true, type: 'railing', basis: 'm', mass_kg_per_unit: 12, cost_per_unit: 2800, install_h_per_unit: 1, demountable: true, height_mm: 1000, ownSupports: true, appearance: 'steel-black', source: PH('demo') },
  ],

  electrical: [
    { maxPower_kw: 3.6, voltage: 230, breaker_A: 16, cable: 'CYKY-J 3×2,5', source: PH('ověřit projektantem elektro (ČSN 33 2000-5-52)') },
    { maxPower_kw: 9, voltage: 400, breaker_A: 16, cable: 'CYKY-J 5×2,5', source: PH('ověřit projektantem elektro (ČSN 33 2000-5-52)') },
    { maxPower_kw: 11, voltage: 400, breaker_A: 20, cable: 'CYKY-J 5×4', source: PH('ověřit projektantem elektro (ČSN 33 2000-5-52)') },
    { maxPower_kw: 15, voltage: 400, breaker_A: 25, cable: 'CYKY-J 5×6', source: PH('ověřit projektantem elektro (ČSN 33 2000-5-52)') },
    { maxPower_kw: 18, voltage: 400, breaker_A: 32, cable: 'CYKY-J 5×6', source: PH('ověřit projektantem elektro (ČSN 33 2000-5-52)') },
  ],

  rules: DEFAULT_RULES,

  limits: {
    zoneMinLength_mm: {
      sauna: { value: 1800, source: { ref: 'zadání MVP, pravidlo 8' } },
      changing: { value: 900, source: { ref: 'zadání MVP, pravidlo 8' } },
    },
    eqVolumePerGlass_m3_per_m2: { value: 1.2, source: { ref: 'zadání MVP / běžné pravidlo výrobců kamen' } },
    eqVolumePerUninsulated_m3_per_m2: { value: 1.2, source: { ref: 'zadání MVP' } },
    topBenchToCeiling_mm: { min: 1100, max: 1200, source: { ref: 'zadání MVP, pravidlo 3' } },
    doorMinClearWidth_mm: { value: 600, source: { ref: 'zadání MVP, pravidlo 4' } },
    doorClearDepth_mm: { value: 600, source: PH('volný průchod za dveřmi uvnitř sauny – návrh') },
    maxOpeningSlotsWithoutReinforcement: {
      custom_frame: { value: 2, source: PH('zadání [N] – návrh, ověřit statikem') },
      iso_20hc: { value: 1, source: PH('přísnější limit pro ISO – návrh, ověřit statikem') },
    },
    flueMinRoofEdgeDistance_mm: { value: 300, source: PH('odstup kouřovodu od okapu – návrh') },
    ventilation: {
      supplyHeight_mm: { value: 300, source: PH('přívod u/pod kamny – návrh') },
      exhaustBelowCeiling_mm: { value: 300, source: PH('odvod pod stropem – návrh') },
      exhaustCornerOffset_mm: { value: 300, source: PH('odvod u protilehlého rohu – návrh') },
      grilleSku: 'VENT-GRILLE-100',
      diameter_mm: 100,
    },
    liftReactionSpreadWarn: { value: 0.25, source: { ref: 'zadání MVP' } },
    transport: {
      maxWidth_mm: { value: 2550, source: { ref: 'směrnice 96/53/ES (2,55 m)' } },
      maxHeightOnVehicle_mm: { value: 4000, source: { ref: 'směrnice 96/53/ES (4,00 m)' } },
      vehicles: [
        { id: 'truck_hiab', maxMass_kg: 9000, deckHeight_mm: 1250, needsMobileCrane: false, name: { cs: 'Nákladní auto s hydraulickou rukou', de: 'LKW mit Ladekran' }, source: PH('zadání [9 000] kg; výška ložné plochy – návrh') },
        { id: 'truck_crane', maxMass_kg: 24000, deckHeight_mm: 950, needsMobileCrane: true, name: { cs: 'Nákladní auto + autojeřáb', de: 'LKW + Mobilkran' }, source: PH('návrh') },
      ],
    },
    g_m_s2: 9.81,
  },

  rates: {
    labour_per_h: 650,
    transport: { per_km: 55, flat: 3500, defaultDistance_km: 150, oversizeSurcharge: 12000 },
    crane: { flat: 9000, per_h: 2200, defaultHours: 3 },
    margin: { steel: 0.25, timber: 0.3, purchased: 0.2, labour: 0.35, transport: 0.1, crane: 0.1 },
    priceDisplay: 'range',
    priceRange: 0.1,
    priceRounding_czk: 1000,
    eurPerCzk: 0.04,
  },
};
