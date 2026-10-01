import * as THREE from 'three';

/**
 * Viewer material library: material id (catalog `appearance` / fixed ids) → PBR material.
 * Tenants can override any entry (colour, roughness, texture URL) without code changes.
 */
export interface MaterialDef {
  color: string;
  roughness: number;
  metalness: number;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  /** Optional colour texture (jpg/png/ktx2), tiled every `tile_mm` millimetres. */
  map?: string;
  tile_mm?: number;
}

export const DEFAULT_MATERIALS: Record<string, MaterialDef> = {
  steel: { color: '#5d6166', roughness: 0.45, metalness: 0.85 },
  'steel-galv': { color: '#a7acb0', roughness: 0.5, metalness: 0.8 },
  'steel-black': { color: '#1f2124', roughness: 0.6, metalness: 0.6 },
  'steel-stainless': { color: '#c9ccce', roughness: 0.3, metalness: 0.9 },
  glass: { color: '#a9c6cf', roughness: 0.05, metalness: 0, opacity: 0.32 },
  thermowood: { color: '#7a5233', roughness: 0.75, metalness: 0 },
  yakisugi: { color: '#26221f', roughness: 0.9, metalness: 0 },
  'trapez-anthracite': { color: '#3b3e42', roughness: 0.55, metalness: 0.4 },
  aspen: { color: '#e3cfa5', roughness: 0.7, metalness: 0 },
  'thermo-aspen': { color: '#a87a4f', roughness: 0.7, metalness: 0 },
  abachi: { color: '#e8d6a8', roughness: 0.7, metalness: 0 },
  'thermowood-floor': { color: '#6e4a2e', roughness: 0.8, metalness: 0 },
  'thermowood-deck': { color: '#866043', roughness: 0.85, metalness: 0 },
  insulation: { color: '#d9c66a', roughness: 1, metalness: 0 },
  'container-corrugated': { color: '#6f7a63', roughness: 0.6, metalness: 0.5 },
  'container-steel': { color: '#4f5548', roughness: 0.6, metalness: 0.5 },
  concrete: { color: '#9a9893', roughness: 0.95, metalness: 0 },
  'heater-wood': { color: '#202020', roughness: 0.6, metalness: 0.7 },
  'heater-electric': { color: '#8d9196', roughness: 0.35, metalness: 0.85 },
  'light-emissive': { color: '#ffd9a0', roughness: 0.4, metalness: 0, emissive: '#ffb860', emissiveIntensity: 2 },
  osb: { color: '#c9a66b', roughness: 0.9, metalness: 0 },
  floor: { color: '#6e4a2e', roughness: 0.8, metalness: 0 },
  ground: { color: '#7d8a6a', roughness: 1, metalness: 0 },
  fallback: { color: '#9a9a9a', roughness: 0.8, metalness: 0 },
};

export type TextureFactory = (key: string, grain?: { along: 'u' | 'v'; pitch_mm: number }) => THREE.Texture | null;

/** Board-joint stripe texture (lamellas), generated on a 2D canvas; null outside the browser. */
export const jointTexture: TextureFactory = (_key, grain) => {
  if (!grain || typeof document === 'undefined') return null;
  // One period = one board: dark joint + light edge, then plain board colour.
  const alongU = grain.along === 'u';
  const c = document.createElement('canvas');
  c.width = alongU ? 64 : 4;
  c.height = alongU ? 4 : 64;
  const g = c.getContext('2d');
  if (!g) return null;
  const band = (from: number, size: number, colour: string) => {
    g.fillStyle = colour;
    if (alongU) g.fillRect(from, 0, size, 4);
    else g.fillRect(0, from, 4, size);
  };
  band(0, 64, '#ffffff');
  band(0, 3, '#5a5a5a');
  band(3, 2, '#e9e9e9');
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  // Panel cap UVs are shape coordinates in mm (ExtrudeGeometry), so repeat = 1 / pitch.
  if (alongU) t.repeat.set(1 / grain.pitch_mm, 1 / 1000);
  else t.repeat.set(1 / 1000, 1 / grain.pitch_mm);
  return t;
};

export class MaterialLibrary {
  private readonly defs: Record<string, MaterialDef>;
  private readonly cache = new Map<string, THREE.MeshStandardMaterial>();
  private readonly highlight = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  private readonly loader?: (url: string) => THREE.Texture;

  constructor(overrides: Record<string, Partial<MaterialDef>> = {}, loader?: (url: string) => THREE.Texture, private readonly textures: TextureFactory = jointTexture) {
    this.defs = { ...DEFAULT_MATERIALS };
    for (const [k, v] of Object.entries(overrides)) this.defs[k] = { ...(this.defs[k] ?? DEFAULT_MATERIALS.fallback!), ...v } as MaterialDef;
    if (loader) this.loader = loader;
  }

  /** Material for an id; `grain` adds the lamella joint texture (cached per id + grain). */
  get(id: string | undefined, grain?: { along: 'u' | 'v'; pitch_mm: number }): THREE.MeshStandardMaterial {
    const key = `${id ?? 'fallback'}${grain ? `|${grain.along}|${grain.pitch_mm}` : ''}`;
    let m = this.cache.get(key);
    if (m) return m;
    const d = this.defs[id ?? 'fallback'] ?? this.defs.fallback!;
    m = new THREE.MeshStandardMaterial({ color: d.color, roughness: d.roughness, metalness: d.metalness });
    m.name = key;
    if (d.opacity !== undefined && d.opacity < 1) {
      m.transparent = true;
      m.opacity = d.opacity;
      m.depthWrite = false;
    }
    if (d.emissive) {
      m.emissive = new THREE.Color(d.emissive);
      m.emissiveIntensity = d.emissiveIntensity ?? 1;
    }
    if (d.map && this.loader) {
      const t = this.loader(d.map);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      const tile = d.tile_mm ?? 1000;
      t.repeat.set(1 / tile, 1 / tile);
      m.map = t;
    } else if (grain) {
      const t = this.textures(key, grain);
      if (t) m.map = t;
    }
    this.cache.set(key, m);
    return m;
  }

  /** Emissive-tinted clone used for hovered / selected slots. */
  highlighted(base: THREE.Material): THREE.MeshStandardMaterial {
    let h = this.highlight.get(base);
    if (!h) {
      h = (base as THREE.MeshStandardMaterial).clone();
      h.emissive = new THREE.Color('#ff8a00');
      h.emissiveIntensity = 0.35;
      this.highlight.set(base, h);
    }
    return h;
  }

  dispose(): void {
    for (const m of [...this.cache.values(), ...this.highlight.values()]) {
      m.map?.dispose();
      m.dispose();
    }
    this.cache.clear();
    this.highlight.clear();
  }
}
