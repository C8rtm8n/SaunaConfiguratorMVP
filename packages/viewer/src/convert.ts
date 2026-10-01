import * as THREE from 'three';
import type { CylinderNode, ExtrudeNode, GroupNode, NodeTags, PanelNode, SceneNode, Section2D } from '@sauna/core';
import type { MaterialLibrary } from './materials.js';

/**
 * SceneNode (core, mm, Z-up) → Three.js objects in the same coordinates.
 * The caller puts the result under a root that converts to metres / Y-up.
 *
 * Batching: boxes and box instances with the same material + tags become one
 * InstancedMesh (unit cube); extruded members with the same section become one
 * InstancedMesh (unit-length extrusion). Panels with holes, cylinders, assets
 * and slot-pickable nodes stay individual meshes.
 */

export interface ObjectTags {
  cutaway?: NodeTags['cutaway'];
  slot?: NonNullable<NodeTags['slot']>;
  nodeIds: string[];
}

export const tagsOf = (o: THREE.Object3D): ObjectTags | undefined => o.userData['sauna'] as ObjectTags | undefined;

export interface AssetResolver {
  /** Returns an object to replace the placeholder box (fitted by the caller), or null. */
  load(url: string): Promise<THREE.Object3D | null>;
}

export class GeometryCache {
  readonly box = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5); // unit cube at origin corner
  readonly cylinder = new THREE.CylinderGeometry(1, 1, 1, 20, 1);
  private readonly sections = new Map<string, THREE.ExtrudeGeometry>();
  private readonly owned = new Set<THREE.BufferGeometry>([this.box, this.cylinder]);

  /** True for shared geometry that must not be disposed with a component. */
  owns(g: THREE.BufferGeometry): boolean {
    return this.owned.has(g);
  }

  /** Unit-length extrusion along local +Z of a section (with roll applied). */
  section(s: Section2D, roll = 0): THREE.ExtrudeGeometry {
    const key = JSON.stringify([s, roll]);
    let g = this.sections.get(key);
    if (!g) {
      const c = Math.cos(roll);
      const sn = Math.sin(roll);
      const pt = ([u, v]: readonly [number, number]) => new THREE.Vector2(u * c - v * sn, u * sn + v * c);
      const shape = new THREE.Shape(s.outer.map(pt));
      for (const h of s.holes ?? []) shape.holes.push(new THREE.Path(h.map(pt)));
      g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 });
      this.sections.set(key, g);
      this.owned.add(g);
    }
    return g;
  }

  dispose(): void {
    this.box.dispose();
    this.cylinder.dispose();
    for (const g of this.sections.values()) g.dispose();
    this.sections.clear();
    this.owned.clear();
  }
}

const AXES = {
  // Right-handed (u, v, w) bases, see core scene.ts (D-028).
  x: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)],
  y: [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)],
  z: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
} as const;

/** Matrix mapping the unit-length section extrusion onto an axis-parallel member. */
export function memberMatrix(n: Pick<ExtrudeNode, 'from' | 'to'>): THREE.Matrix4 {
  const d = [n.to[0] - n.from[0], n.to[1] - n.from[1], n.to[2] - n.from[2]];
  const i = d.map(Math.abs).indexOf(Math.max(...d.map(Math.abs)));
  const axis = (['x', 'y', 'z'] as const)[i]!;
  const len = Math.abs(d[i]!);
  const start = d[i]! >= 0 ? n.from : n.to;
  const [u, v, w] = AXES[axis];
  return new THREE.Matrix4().makeBasis(u, v, w.clone().multiplyScalar(len)).setPosition(start[0], start[1], start[2]);
}

export function boxMatrix(min: readonly number[], size: readonly number[]): THREE.Matrix4 {
  return new THREE.Matrix4().makeScale(size[0]!, size[1]!, size[2]!).setPosition(min[0]!, min[1]!, min[2]!);
}

const PLANE_BASIS = {
  xz: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)],
  yz: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)],
  xy: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
} as const;

/** Panel geometry (shape with holes, extruded by thickness) and its placement matrix. */
export function panelMesh(n: PanelNode, mat: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(n.width_mm, 0), new THREE.Vector2(n.width_mm, n.height_mm), new THREE.Vector2(0, n.height_mm)]);
  for (const h of n.holes ?? []) {
    shape.holes.push(new THREE.Path([new THREE.Vector2(h.u, h.v), new THREE.Vector2(h.u, h.v + h.h), new THREE.Vector2(h.u + h.w, h.v + h.h), new THREE.Vector2(h.u + h.w, h.v)]));
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: n.thickness_mm, bevelEnabled: false, curveSegments: 1 });
  const [u, v, w] = PLANE_BASIS[n.plane];
  const mesh = new THREE.Mesh(geo, mat);
  // 'xz' has a left-handed basis (det −1); WebGLRenderer flips the face winding for such meshes.
  mesh.matrixAutoUpdate = false;
  mesh.matrix.makeBasis(u, v, w).setPosition(n.min[0], n.min[1], n.min[2]);
  return mesh;
}

export function cylinderMatrix(n: CylinderNode): THREE.Matrix4 {
  const a = new THREE.Vector3(...n.from);
  const b = new THREE.Vector3(...n.to);
  const d = b.clone().sub(a);
  const len = d.length();
  d.normalize();
  const helper = Math.abs(d.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const x = new THREE.Vector3().crossVectors(helper, d).normalize();
  const z = new THREE.Vector3().crossVectors(x, d).normalize();
  const mid = a.add(b).multiplyScalar(0.5);
  return new THREE.Matrix4()
    .makeBasis(x.multiplyScalar(n.radius_mm), d.multiplyScalar(len), z.multiplyScalar(n.radius_mm))
    .setPosition(mid);
}

interface Batch {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
  tags: ObjectTags;
  castShadow: boolean;
}

/** Converts one component group (and nested groups) into a THREE.Group. */
export function buildComponent(node: GroupNode, lib: MaterialLibrary, cache: GeometryCache, assets?: AssetResolver): THREE.Group {
  const root = new THREE.Group();
  root.name = node.id;
  const batches = new Map<string, Batch>();
  const tagKey = (t?: NodeTags) => `${t?.cutaway ?? ''}|${t?.castShadow ? 1 : 0}`;
  const addToBatch = (key: string, geometry: THREE.BufferGeometry, material: THREE.Material, m: THREE.Matrix4, id: string, tags?: NodeTags) => {
    let b = batches.get(key);
    if (!b) {
      b = { geometry, material, matrices: [], tags: { nodeIds: [] }, castShadow: tags?.castShadow ?? true };
      if (tags?.cutaway) b.tags.cutaway = tags.cutaway;
      batches.set(key, b);
    }
    b.matrices.push(m);
    b.tags.nodeIds.push(id);
  };
  const single = (obj: THREE.Mesh, n: SceneNode) => {
    obj.name = n.id;
    const tags: ObjectTags = { nodeIds: [n.id] };
    if (n.tags?.cutaway) tags.cutaway = n.tags.cutaway;
    if (n.tags?.slot) tags.slot = n.tags.slot;
    obj.userData['sauna'] = tags;
    obj.castShadow = n.tags?.castShadow ?? true;
    obj.receiveShadow = true;
    root.add(obj);
  };

  const visit = (n: SceneNode) => {
    switch (n.type) {
      case 'group':
        n.children.forEach(visit);
        return;
      case 'box': {
        const mat = lib.get(n.material);
        if (n.tags?.slot) {
          const mesh = new THREE.Mesh(cache.box, mat);
          mesh.matrixAutoUpdate = false;
          mesh.matrix.copy(boxMatrix(n.min, n.size));
          single(mesh, n);
        } else addToBatch(`box|${mat.name}|${tagKey(n.tags)}`, cache.box, mat, boxMatrix(n.min, n.size), n.id, n.tags);
        return;
      }
      case 'instances': {
        const mat = lib.get(n.material);
        n.instances.forEach((min, i) => addToBatch(`box|${mat.name}|${tagKey(n.tags)}`, cache.box, mat, boxMatrix(min, n.size), `${n.id}#${i}`, n.tags));
        return;
      }
      case 'extrude': {
        const mat = lib.get(n.material);
        const geo = cache.section(n.section, n.roll ?? 0);
        addToBatch(`ext|${geo.uuid}|${mat.name}|${tagKey(n.tags)}`, geo, mat, memberMatrix(n), n.id, n.tags);
        return;
      }
      case 'panel':
        single(panelMesh(n, lib.get(n.material, n.grain)), n);
        return;
      case 'cylinder': {
        const mesh = new THREE.Mesh(cache.cylinder, lib.get(n.material));
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(cylinderMatrix(n));
        single(mesh, n);
        return;
      }
      case 'asset': {
        // Placeholder = bounding box; replaced when the GLB arrives.
        const ph = new THREE.Mesh(cache.box, lib.get(n.material));
        ph.matrixAutoUpdate = false;
        ph.matrix.copy(boxMatrix(n.min, n.size));
        single(ph, n);
        assets?.load(n.asset).then((obj) => {
          if (!obj || !ph.parent) return;
          fitInto(obj, n as Extract<SceneNode, { type: 'asset' }>);
          obj.userData['sauna'] = ph.userData['sauna'];
          ph.parent.add(obj);
          ph.removeFromParent();
        });
        return;
      }
    }
  };
  visit(node);

  for (const b of batches.values()) {
    let obj: THREE.Mesh;
    if (b.matrices.length === 1) {
      obj = new THREE.Mesh(b.geometry, b.material);
      obj.matrixAutoUpdate = false;
      obj.matrix.copy(b.matrices[0]!);
    } else {
      const im = new THREE.InstancedMesh(b.geometry, b.material, b.matrices.length);
      b.matrices.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.computeBoundingBox();
      obj = im;
    }
    obj.name = `${node.id}/${b.tags.nodeIds[0]}`;
    obj.userData['sauna'] = b.tags;
    obj.castShadow = b.castShadow;
    obj.receiveShadow = true;
    root.add(obj);
  }
  return root;
}

/** Places a loaded asset into the node's box: centred, uniform scale (assets authored in mm). */
function fitInto(obj: THREE.Object3D, n: Extract<SceneNode, { type: 'asset' }>): void {
  const bb = new THREE.Box3().setFromObject(obj);
  const size = bb.getSize(new THREE.Vector3());
  const s = Math.min(n.size[0] / (size.x || 1), n.size[1] / (size.y || 1), n.size[2] / (size.z || 1));
  obj.scale.setScalar(s);
  if (n.rotZ) obj.rotation.z = n.rotZ;
  const c = bb.getCenter(new THREE.Vector3()).multiplyScalar(s);
  obj.position.set(n.min[0] + n.size[0] / 2 - c.x, n.min[1] + n.size[1] / 2 - c.y, n.min[2] - bb.min.z * s);
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

/** Releases per-component geometry (panels own theirs; cached ones are shared). */
export function disposeComponent(g: THREE.Object3D, cache: GeometryCache): void {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (!cache.owns(m.geometry)) m.geometry.dispose();
    if ((m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose();
  });
}
