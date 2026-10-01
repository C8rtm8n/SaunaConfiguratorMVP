import { describe, expect, it } from 'vitest';
import { frontWall, hiddenInSection } from '../src/section.js';
import { AdaptiveQuality, initialQuality, tierOf } from '../src/quality.js';

describe('section mode', () => {
  const c = [2100, 1150] as const;
  const s = [4200, 2300] as const;
  it('front wall follows the camera', () => {
    expect(frontWall([2100, -5000], c, s)).toBe('S');
    expect(frontWall([2100, 8000], c, s)).toBe('N');
    expect(frontWall([-6000, 1000], c, s)).toBe('W');
    expect(frontWall([9000, 1500], c, s)).toBe('E');
    // corner diagonal is the switch line (normalised by half-size)
    expect(frontWall([-1000, -2000], c, s)).toBe('S');
  });
  it('hides roof and the front wall only', () => {
    expect(hiddenInSection('roof', 'S')).toBe(true);
    expect(hiddenInSection('wall:S', 'S')).toBe(true);
    expect(hiddenInSection('wall:N', 'S')).toBe(false);
    expect(hiddenInSection(undefined, 'S')).toBe(false);
  });
});

describe('adaptive quality', () => {
  it('tiers', () => {
    expect(tierOf({ coarsePointer: false, cores: 8, memoryGb: 16, devicePixelRatio: 2 })).toBe('high');
    expect(tierOf({ coarsePointer: true, cores: 8, memoryGb: 6, devicePixelRatio: 3 })).toBe('mid');
    expect(tierOf({ coarsePointer: true, cores: 2, devicePixelRatio: 2 })).toBe('low');
    const low = initialQuality({ coarsePointer: true, cores: 2, devicePixelRatio: 2 });
    expect(low.shadows).toBe(false);
    expect(low.targetFps).toBe(30);
  });
  it('lowers DPR step by step, then disables shadows', () => {
    const q = initialQuality({ coarsePointer: true, cores: 8, memoryGb: 6, devicePixelRatio: 3 });
    const a = new AdaptiveQuality(q, 10);
    const actions: string[] = [];
    for (let i = 0; i < 200; i++) {
      const r = a.sample(1000 / 15); // 15 fps on a phone
      if (r) actions.push(r);
    }
    expect(actions[0]).toBe('lowerDpr');
    expect(actions.at(-1)).toBe('disableShadows');
    expect(q.dpr).toBeGreaterThanOrEqual(q.minDpr);
    expect(q.shadows).toBe(false);
  });
  it('keeps settings when the target is met', () => {
    const q = initialQuality({ coarsePointer: false, cores: 8, memoryGb: 16, devicePixelRatio: 1 });
    const a = new AdaptiveQuality(q, 10);
    for (let i = 0; i < 100; i++) expect(a.sample(16.6)).toBeNull();
  });
});
