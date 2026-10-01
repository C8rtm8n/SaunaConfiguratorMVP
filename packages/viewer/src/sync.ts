import * as THREE from 'three';
import type { GroupNode } from '@sauna/core';
import { type AssetResolver, buildComponent, disposeComponent, GeometryCache } from './convert.js';
import type { MaterialLibrary } from './materials.js';

export interface SyncResult {
  added: string[];
  rebuilt: string[];
  removed: string[];
  kept: string[];
}

/**
 * Keeps a THREE.Group in sync with the core scene root. Components are diffed by
 * id + content hash: unchanged components keep their Three.js objects (D-030).
 */
export class SceneSync {
  readonly root = new THREE.Group();
  readonly cache = new GeometryCache();
  private readonly built = new Map<string, { hash: string; obj: THREE.Group }>();

  constructor(private readonly lib: MaterialLibrary, private readonly assets?: AssetResolver) {
    this.root.name = 'sauna-module';
    // core: mm, Z-up, Y = width (towards N)  →  three: m, Y-up. (x, y, z) ↦ (x, z, −y) / 1000
    this.root.rotation.x = -Math.PI / 2;
    this.root.scale.setScalar(0.001);
  }

  sync(scene: GroupNode): SyncResult {
    const res: SyncResult = { added: [], rebuilt: [], removed: [], kept: [] };
    const seen = new Set<string>();
    for (const child of scene.children) {
      if (child.type !== 'group') continue;
      seen.add(child.id);
      const prev = this.built.get(child.id);
      if (prev && prev.hash === child.hash && child.hash !== '') {
        res.kept.push(child.id);
        continue;
      }
      if (prev) {
        prev.obj.removeFromParent();
        disposeComponent(prev.obj, this.cache);
      }
      const obj = buildComponent(child, this.lib, this.cache, this.assets);
      this.root.add(obj);
      this.built.set(child.id, { hash: child.hash, obj });
      (prev ? res.rebuilt : res.added).push(child.id);
    }
    for (const [id, b] of this.built) {
      if (seen.has(id)) continue;
      b.obj.removeFromParent();
      disposeComponent(b.obj, this.cache);
      this.built.delete(id);
      res.removed.push(id);
    }
    this.root.updateMatrixWorld(true);
    return res;
  }

  component(id: string): THREE.Group | undefined {
    return this.built.get(id)?.obj;
  }

  dispose(): void {
    for (const b of this.built.values()) disposeComponent(b.obj, this.cache);
    this.built.clear();
    this.cache.dispose();
  }
}
