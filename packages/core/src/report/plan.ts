import type { Box3 } from '../model/component.js';
import type { Evaluation } from '../model/results.js';
import type { SceneNode } from '../model/scene.js';

/**
 * Plan view (SVG) generated from an Evaluation: envelope, rooms, partitions, openings
 * with door swings, heater (+ clearance envelope), benches, attachments and dimension
 * chains. The 'tech' variant adds supports with loads, lifting points, COG and
 * penetrations. North (N wall, y = W) is at the top. Units in labels: mm, kN.
 */
export interface PlanOptions {
  variant: 'offer' | 'tech';
  /** Drawing width in px (height follows the aspect ratio). */
  width?: number;
  /** Labels (localised by the caller). */
  labels?: Partial<Record<'sauna' | 'changing' | 'heater' | 'cog' | 'north', string>>;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function leafRects(n: SceneNode, out: Rect[] = []): Rect[] {
  switch (n.type) {
    case 'group':
      n.children.forEach((c) => leafRects(c, out));
      break;
    case 'box':
    case 'asset':
      out.push({ x0: n.min[0], y0: n.min[1], x1: n.min[0] + n.size[0], y1: n.min[1] + n.size[1] });
      break;
    case 'instances': {
      if (!n.instances.length) break;
      const xs = n.instances.map((p) => p[0]);
      const ys = n.instances.map((p) => p[1]);
      out.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs) + n.size[0], y1: Math.max(...ys) + n.size[1] });
      break;
    }
    default:
      break;
  }
  return out;
}

export function planSvg(ev: Evaluation, opts: PlanOptions): string {
  const g = ev.geometry;
  const env = g.envelope;
  const tech = opts.variant === 'tech';
  const comp = (id: string) => ev.scene.children.find((c) => c.id === id);
  const attachments = ev.scene.children.filter((c) => c.id.startsWith('att-')).flatMap((c) => leafRects(c));
  // Drawing extents in mm (module + attachments + dimension margins).
  const all = [{ x0: env.min[0], y0: env.min[1], x1: env.max[0], y1: env.max[1] }, ...attachments];
  const ext = { x0: Math.min(...all.map((r) => r.x0)), y0: Math.min(...all.map((r) => r.y0)), x1: Math.max(...all.map((r) => r.x1)), y1: Math.max(...all.map((r) => r.y1)) };
  const margin = 900; // mm around the drawing for dimension chains
  const W = opts.width ?? 900;
  const spanX = ext.x1 - ext.x0 + 2 * margin;
  const spanY = ext.y1 - ext.y0 + 2 * margin;
  const k = W / spanX;
  const H = Math.round(spanY * k);
  const X = (x: number) => r1((x - ext.x0 + margin) * k);
  const Y = (y: number) => r1((ext.y1 - y + margin) * k); // N up
  const rect = (r: Rect, cls: string, extra = '') =>
    `<rect class="${cls}" x="${X(Math.min(r.x0, r.x1))}" y="${Y(Math.max(r.y0, r.y1))}" width="${r1(Math.abs(r.x1 - r.x0) * k)}" height="${r1(Math.abs(r.y1 - r.y0) * k)}"${extra}/>`;
  const box = (b: Box3): Rect => ({ x0: b.min[0], y0: b.min[1], x1: b.max[0], y1: b.max[1] });
  const text = (x: number, y: number, s: string, cls = 'lbl', anchor = 'middle') => `<text class="${cls}" x="${X(x)}" y="${Y(y)}" text-anchor="${anchor}">${esc(s)}</text>`;
  const fmt = (mm: number) => String(Math.round(mm));
  const L = opts.labels ?? {};
  const out: string[] = [];

  // Attachments (terrace, stairs, railing, overhang).
  for (const a of attachments) out.push(rect(a, 'att'));
  // Envelope, structure, rooms.
  out.push(rect(box(env), 'env'));
  out.push(rect(box(g.structure), 'str'));
  for (const room of g.rooms) {
    out.push(rect(box(room.box), `room room-${room.zoneType}`));
    const label = room.zoneType === 'sauna' ? (L.sauna ?? 'sauna') : (L.changing ?? 'changing');
    const bx = room.box;
    out.push(text((bx.min[0] + bx.max[0]) / 2, (bx.min[1] + bx.max[1]) / 2, label, 'room-lbl'));
  }
  for (const p of g.partitions) out.push(rect({ x0: p.x_mm - p.thickness_mm / 2, y0: g.inner.min[1], x1: p.x_mm + p.thickness_mm / 2, y1: g.inner.max[1] }, 'part'));

  // Benches, heater (+ clearance envelope).
  const benches = comp('benches');
  if (benches) for (const r of leafRects(benches)) out.push(rect(r, 'bench'));
  const heater = comp('heater');
  if (heater) for (const r of leafRects(heater)) out.push(rect(r, 'heater'));

  // Openings: thick segment in the wall + door swings.
  for (const o of ev.config.openings) {
    const c = comp(`opening-${o.id}`);
    if (!c) continue;
    const r = leafRects(c)[0];
    if (!r) continue;
    out.push(rect(r, `op op-${o.type}`));
    if (o.type !== 'door' || !o.door) continue;
    const alongX = r.x1 - r.x0 > r.y1 - r.y0;
    const w = alongX ? r.x1 - r.x0 : r.y1 - r.y0;
    const cx = (r.x0 + r.x1) / 2;
    const cy = (r.y0 + r.y1) / 2;
    // Swing side: exterior walls → outside; partition → away from the sauna room.
    let n: [number, number];
    if (o.wall === 'S') n = [0, -1];
    else if (o.wall === 'N') n = [0, 1];
    else if (o.wall === 'W') n = [-1, 0];
    else if (o.wall === 'E') n = [1, 0];
    else {
      const sauna = g.rooms.find((rm) => rm.zoneType === 'sauna')!;
      n = [(sauna.box.min[0] + sauna.box.max[0]) / 2 < cx ? 1 : -1, 0];
    }
    if (o.door.swing === 'in') n = [-n[0], -n[1]];
    // Observer on the swing side facing the door: left = rotate(−n) by +90°.
    const f: [number, number] = [-n[0], -n[1]];
    const left: [number, number] = [-f[1], f[0]];
    const s = o.door.hinge === 'left' ? 1 : -1;
    const hinge: [number, number] = [cx + left[0] * s * (w / 2), cy + left[1] * s * (w / 2)];
    const closed: [number, number] = [cx - left[0] * s * (w / 2), cy - left[1] * s * (w / 2)];
    const open: [number, number] = [hinge[0] + n[0] * w, hinge[1] + n[1] * w];
    const pts: string[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = (i / 12) * (Math.PI / 2);
      const u: [number, number] = [(closed[0] - hinge[0]) / w, (closed[1] - hinge[1]) / w];
      const p = [hinge[0] + w * (u[0] * Math.cos(t) + n[0] * Math.sin(t)), hinge[1] + w * (u[1] * Math.cos(t) + n[1] * Math.sin(t))] as const;
      pts.push(`${X(p[0])},${Y(p[1])}`);
    }
    out.push(`<polyline class="swing" points="${pts.join(' ')}"/>`);
    out.push(`<line class="leaf" x1="${X(hinge[0])}" y1="${Y(hinge[1])}" x2="${X(open[0])}" y2="${Y(open[1])}"/>`);
  }

  // Dimension chains: overall length (below), zones (above), width (right).
  const dimH = (x0: number, x1: number, y: number, cls = 'dim') =>
    `<line class="${cls}" x1="${X(x0)}" y1="${Y(y)}" x2="${X(x1)}" y2="${Y(y)}"/>` +
    `<line class="tick" x1="${X(x0)}" y1="${Y(y) - 5}" x2="${X(x0)}" y2="${Y(y) + 5}"/><line class="tick" x1="${X(x1)}" y1="${Y(y) - 5}" x2="${X(x1)}" y2="${Y(y) + 5}"/>` +
    text((x0 + x1) / 2, y + 60, fmt(x1 - x0), 'dimtxt');
  const dimV = (y0: number, y1: number, x: number) =>
    `<line class="dim" x1="${X(x)}" y1="${Y(y0)}" x2="${X(x)}" y2="${Y(y1)}"/>` +
    `<line class="tick" x1="${X(x) - 5}" y1="${Y(y0)}" x2="${X(x) + 5}" y2="${Y(y0)}"/><line class="tick" x1="${X(x) - 5}" y1="${Y(y1)}" x2="${X(x) + 5}" y2="${Y(y1)}"/>` +
    `<text class="dimtxt" x="${X(x) + 14}" y="${r1((Y(y0) + Y(y1)) / 2)}" transform="rotate(-90 ${X(x) + 14} ${r1((Y(y0) + Y(y1)) / 2)})" text-anchor="middle">${fmt(y1 - y0)}</text>`;
  out.push(dimH(env.min[0], env.max[0], ext.y0 - 450));
  if (ev.config.zones.length > 1) for (const z of ev.config.zones) out.push(dimH(z.from_mm, z.to_mm, ext.y1 + 400));
  out.push(dimV(env.min[1], env.max[1], ext.x1 + 450));

  if (tech) {
    const midY = (env.min[1] + env.max[1]) / 2;
    const midX = (env.min[0] + env.max[0]) / 2;
    // Supports: labels outside the envelope; lifting points: labels inside.
    for (const p of ev.supports.points) {
      const top = p.position_mm[1] > midY;
      out.push(`<circle class="sup" cx="${X(p.position_mm[0])}" cy="${Y(p.position_mm[1])}" r="6"/>`);
      out.push(text(p.position_mm[0], top ? env.max[1] + 120 : env.min[1] - 260, `${p.id} ${p.R_kN.toFixed(1)} kN`, 'sup-lbl'));
    }
    for (const p of ev.lift.points) {
      const top = p.position_mm[1] > midY;
      const right = p.position_mm[0] > midX;
      out.push(`<rect class="lift" x="${X(p.position_mm[0]) - 5}" y="${Y(p.position_mm[1]) - 5}" width="10" height="10"/>`);
      out.push(text(p.position_mm[0] + (right ? -120 : 120), p.position_mm[1] + (top ? -260 : 160), `${p.id} ${p.R_kN.toFixed(1)} kN`, 'lift-lbl', right ? 'end' : 'start'));
    }
    const c = ev.mass.transport_cog_mm;
    out.push(`<g class="cog"><circle cx="${X(c[0])}" cy="${Y(c[1])}" r="9"/><line x1="${X(c[0]) - 14}" y1="${Y(c[1])}" x2="${X(c[0]) + 14}" y2="${Y(c[1])}"/><line x1="${X(c[0])}" y1="${Y(c[1]) - 14}" x2="${X(c[0])}" y2="${Y(c[1]) + 14}"/></g>`);
    out.push(text(c[0] + 120, c[1] + 120, `${L.cog ?? 'COG'} [${fmt(c[0])}; ${fmt(c[1])}; ${fmt(c[2])}]`, 'cog-lbl', 'start'));
    for (const p of ev.penetrations) {
      out.push(`<circle class="pen pen-${p.kind}" cx="${X(p.position_mm[0])}" cy="${Y(p.position_mm[1])}" r="5"/>`);
      out.push(text(p.position_mm[0], p.position_mm[1] + 110, p.id, 'pen-lbl'));
    }
  }
  // North arrow.
  out.push(`<g class="north" transform="translate(${W - 40} 40)"><path d="M0 -18 L7 8 L0 3 L-7 8 Z"/><text y="24" text-anchor="middle">${esc(L.north ?? 'N')}</text></g>`);

  const style = `
    .env{fill:#fff;stroke:#222;stroke-width:2}.str{fill:none;stroke:#888;stroke-width:1;stroke-dasharray:6 4}
    .room{fill:#f7efe2;stroke:#b9a68c;stroke-width:1}.room-changing{fill:#eef2f4}.part{fill:#cbb59a;stroke:#8a7357}
    .room-lbl{font:600 14px sans-serif;fill:#6b5a46}.bench{fill:#e5cf9f;stroke:#a88b55;stroke-width:1}.heater{fill:#333;stroke:#000}
    .op{fill:#7fb7d1;stroke:#2f6f8f;stroke-width:1}.op-door{fill:#2f6f8f}.swing,.leaf{fill:none;stroke:#2f6f8f;stroke-width:1.2}
    .att{fill:#efe6da;stroke:#a08a6d;stroke-width:1;stroke-dasharray:3 2}
    .dim,.tick{stroke:#555;stroke-width:1}.dimtxt{font:12px sans-serif;fill:#333}
    .sup{fill:#c0392b}.sup-lbl{font:11px sans-serif;fill:#c0392b}.lift{fill:#1f6feb}.lift-lbl{font:11px sans-serif;fill:#1f6feb}
    .cog circle{fill:none;stroke:#111;stroke-width:1.5}.cog line{stroke:#111;stroke-width:1.5}.cog-lbl{font:11px sans-serif}
    .pen{fill:#f39c12;stroke:#9a5d00}.pen-lbl{font:10px sans-serif;fill:#9a5d00}.lbl{font:11px sans-serif}
    .north path{fill:#222}.north text{font:11px sans-serif}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"><style>${style}</style>${out.join('')}</svg>`;
}
