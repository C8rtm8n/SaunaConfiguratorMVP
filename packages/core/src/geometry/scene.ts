import type { ProfileShape } from '../model/catalog.js';
import type { Box3 } from '../model/component.js';
import type { BoxNode, GroupNode, NodeTags, SceneNode, Section2D } from '../model/scene.js';
import type { Mm, Vec2 } from '../model/units.js';

/** Section outline centred on the member axis; u = horizontal width, v = height. */
export function sectionOf(s: ProfileShape): Section2D {
  const rect = (w: number, h: number): Vec2[] => [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
  switch (s.shape) {
    case 'RHS':
      return { outer: rect(s.b, s.h), holes: [rect(s.b - 2 * s.t, s.h - 2 * s.t).reverse()] };
    case 'U': {
      const { b, h, tw, tf } = s;
      const x0 = -b / 2;
      const y0 = -h / 2;
      return {
        outer: [
          [x0, y0], [x0 + b, y0], [x0 + b, y0 + tf], [x0 + tw, y0 + tf],
          [x0 + tw, y0 + h - tf], [x0 + b, y0 + h - tf], [x0 + b, y0 + h], [x0, y0 + h],
        ],
      };
    }
    case 'L': {
      const { a, b, t } = s;
      const x0 = -b / 2;
      const y0 = -a / 2;
      return { outer: [[x0, y0], [x0 + b, y0], [x0 + b, y0 + t], [x0 + t, y0 + t], [x0 + t, y0 + a], [x0, y0 + a]] };
    }
  }
}

/** (u, v) envelope of a section: u = width, v = height. */
export function sectionSize(s: ProfileShape): { u: Mm; v: Mm } {
  switch (s.shape) {
    case 'RHS':
      return { u: s.b, v: s.h };
    case 'U':
      return { u: s.b, v: s.h };
    case 'L':
      return { u: s.b, v: s.a };
  }
}

export function boxNode(id: string, b: Box3, material?: string, tags?: NodeTags): BoxNode {
  const n: BoxNode = {
    type: 'box',
    id,
    min: b.min,
    size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]],
  };
  if (material) n.material = material;
  if (tags) n.tags = tags;
  return n;
}

/** Group; hash is filled in by evaluate(). */
export function group(id: string, children: SceneNode[], tags?: NodeTags): GroupNode {
  const g: GroupNode = { type: 'group', id, hash: '', children };
  if (tags) g.tags = tags;
  return g;
}
