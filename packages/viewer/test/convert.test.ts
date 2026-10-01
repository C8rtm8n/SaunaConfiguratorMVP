import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { evaluate, type ExtrudeNode, type GroupNode, type SceneNode } from '@sauna/core';
import { DEMO_CATALOG, REF1_CUSTOM_4200_WOOD, REF2_CUSTOM_6000_TWO_ZONES, REF3_ISO20HC_GLASS_FRONT } from '@sauna/core/fixtures';
import { memberMatrix } from '../src/convert.js';
import { MaterialLibrary } from '../src/materials.js';
import { SceneSync } from '../src/sync.js';
import { tagsOf } from '../src/convert.js';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function leaves(n: SceneNode, out: SceneNode[] = []): SceneNode[] {
  if (n.type === 'group') n.children.forEach((c) => leaves(c, out));
  else out.push(n);
  return out;
}

/** World-space (core mm) bounding box of a node computed from core data. */
function coreBox(n: SceneNode): THREE.Box3 | undefined {
  switch (n.type) {
    case 'box':
      return new THREE.Box3(new THREE.Vector3(...n.min), new THREE.Vector3(n.min[0] + n.size[0], n.min[1] + n.size[1], n.min[2] + n.size[2]));
    default:
      return undefined;
  }
}

describe('SceneNode → three.js', () => {
  for (const ref of [REF1_CUSTOM_4200_WOOD, REF2_CUSTOM_6000_TWO_ZONES, REF3_ISO20HC_GLASS_FRONT]) {
    it(`${ref.id}: every leaf node is represented exactly once`, () => {
      const e = evaluate(ref, DEMO_CATALOG);
      const sync = new SceneSync(new MaterialLibrary());
      sync.sync(e.scene);
      const ids: string[] = [];
      let draws = 0;
      sync.root.traverse((o) => {
        const t = tagsOf(o);
        if (t && (o as THREE.Mesh).isMesh) {
          ids.push(...t.nodeIds);
          draws++;
        }
      });
      const expected = leaves(e.scene).flatMap((n) => (n.type === 'instances' ? n.instances.map((_, i) => `${n.id}#${i}`) : [n.id]));
      expect(ids.sort()).toEqual(expected.sort());
      // instancing (frame members, boards, boxes) keeps the mesh count bounded
      expect(draws).toBeLessThanOrEqual(110);
      console.log(`${ref.id}: ${expected.length} nodes → ${draws} meshes`);
    });
  }

  it('module bounding box in three.js space = envelope in metres, Y-up', () => {
    const e = evaluate(REF1_CUSTOM_4200_WOOD, DEMO_CATALOG);
    const sync = new SceneSync(new MaterialLibrary());
    sync.sync(e.scene);
    const b = new THREE.Box3();
    for (const id of ['wall-S', 'wall-N', 'wall-W', 'wall-E', 'roof']) b.expandByObject(sync.component(id)!);
    const env = e.geometry.envelope;
    expect(b.min.x).toBeCloseTo(env.min[0] / 1000, 4);
    expect(b.max.x).toBeCloseTo(env.max[0] / 1000, 4);
    expect(b.max.y).toBeCloseTo(env.max[2] / 1000, 4); // height → Y
    expect(b.min.z).toBeCloseTo(-env.max[1] / 1000, 4); // N wall → −Z
    expect(b.max.z).toBeCloseTo(-env.min[1] / 1000, 4);
  });

  it('instanced boxes and members land where core put them', () => {
    const e = evaluate(REF2_CUSTOM_6000_TWO_ZONES, DEMO_CATALOG);
    const sync = new SceneSync(new MaterialLibrary());
    sync.sync(e.scene);
    const frame = e.scene.children.find((c) => c.id === 'frame') as GroupNode;
    const members = leaves(frame).filter((n): n is ExtrudeNode => n.type === 'extrude');
    for (const m of members) {
      const mat = memberMatrix(m);
      // the unit extrusion's axis end points map onto from/to
      const a = new THREE.Vector3(0, 0, 0).applyMatrix4(mat);
      const b = new THREE.Vector3(0, 0, 1).applyMatrix4(mat);
      const ends = [a.toArray(), b.toArray()].map((v) => v.map((x) => Math.round(x * 1000) / 1000).join(','));
      const want = [m.from, m.to].map((v) => v.map((x) => Math.round(x * 1000) / 1000).join(','));
      expect(ends.sort()).toEqual(want.sort());
      expect(mat.determinant()).toBeGreaterThan(0); // right-handed → instancing-safe
    }
    // boxes: world box of the instanced terrace = core box (mm → m)
    const att = sync.component('att-terrace-1')!;
    const box = new THREE.Box3().setFromObject(att);
    const core = coreBox(leaves(e.scene.children.find((c) => c.id === 'att-terrace-1')!)[0]!)!;
    expect(box.min.x).toBeCloseTo(core.min.x / 1000, 5);
    expect(box.max.y).toBeCloseTo(core.max.z / 1000, 5);
  });

  it('panels with holes: hole area removed from the mesh', () => {
    const e = evaluate(REF1_CUSTOM_4200_WOOD, DEMO_CATALOG);
    const sync = new SceneSync(new MaterialLibrary());
    sync.sync(e.scene);
    const wall = sync.component('wall-S')!;
    const door = wall.children.find((o) => o.name.includes('clad/slot-3')) as THREE.Mesh;
    expect(door).toBeDefined();
    expect(tagsOf(door)?.slot).toEqual({ wall: 'S', index: 3 });
    const shape = (door.geometry as THREE.ExtrudeGeometry).parameters.shapes as THREE.Shape;
    expect(shape.holes.length).toBe(1);
  });
});

describe('diff by component id + hash', () => {
  it('only changed components are rebuilt', () => {
    const lib = new MaterialLibrary();
    const sync = new SceneSync(lib);
    const c = clone(REF1_CUSTOM_4200_WOOD);
    const first = sync.sync(evaluate(c, DEMO_CATALOG).scene);
    expect(first.rebuilt).toEqual([]);
    const heaterObj = sync.component('heater');
    const wallObj = sync.component('wall-S');
    c.sauna.heater.along_mm += 100;
    const second = sync.sync(evaluate(c, DEMO_CATALOG).scene);
    // heater, chimney and ventilation follow the heater; nothing else changes
    expect(second.rebuilt.sort()).toEqual(['chimney', 'heater', 'ventilation']);
    expect(second.added).toEqual([]);
    expect(sync.component('wall-S')).toBe(wallObj);
    expect(sync.component('heater')).not.toBe(heaterObj);
  });

  it('removed components are dropped', () => {
    const sync = new SceneSync(new MaterialLibrary());
    sync.sync(evaluate(REF2_CUSTOM_6000_TWO_ZONES, DEMO_CATALOG).scene);
    const c = clone(REF2_CUSTOM_6000_TWO_ZONES);
    c.attachments = [];
    const r = sync.sync(evaluate(c, DEMO_CATALOG).scene);
    expect(r.removed.sort()).toEqual(['att-rail-1', 'att-stairs-1', 'att-terrace-1']);
    expect(sync.component('att-terrace-1')).toBeUndefined();
  });
});
