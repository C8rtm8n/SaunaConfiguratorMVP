import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate.js';
import { planSvg } from '../report/plan.js';
import { DEMO_CATALOG } from '../fixtures/demoCatalog.js';
import { REF2_CUSTOM_6000_TWO_ZONES as REF2 } from '../fixtures/referenceConfigs.js';

describe('plan SVG', () => {
  const ev = evaluate(REF2, DEMO_CATALOG);
  it('offer: dimension chains, rooms, door swings', () => {
    const svg = planSvg(ev, { variant: 'offer' });
    expect(svg.startsWith('<svg')).toBe(true);
    for (const d of ['6000', '3600', '2400', '2300']) expect(svg).toContain(`>${d}</text>`);
    expect((svg.match(/class="swing"/g) ?? []).length).toBe(2); // exterior door + sauna door
    expect(svg).not.toContain('class="sup"');
  });
  it('tech: supports with kN, 4 lifting points, COG and penetrations', () => {
    const svg = planSvg(ev, { variant: 'tech', labels: { cog: 'Těžiště' } });
    expect((svg.match(/class="sup"/g) ?? []).length).toBe(ev.supports.points.length);
    expect((svg.match(/class="lift"/g) ?? []).length).toBe(4);
    expect(svg).toContain('Těžiště [');
    expect((svg.match(/class="pen /g) ?? []).length).toBe(ev.penetrations.length);
  });
  it('escapes labels', () => {
    expect(planSvg(ev, { variant: 'offer', labels: { sauna: '<b>&' } })).toContain('&lt;b&gt;&amp;');
  });
});
