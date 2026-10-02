import type { WallId } from '@sauna/core';
import { useApp } from '../state.js';
import { Check, Choice, Section, Select, Slider } from '../components/ui.js';
import type { I18nKey } from '../i18n.js';

export function Step5Interior() {
  const { config, tenant, i18n, edit, ev } = useApp();
  const { t, tx, m, num } = i18n;
  const cat = tenant.catalog;
  const room = ev.geometry.rooms.find((r) => r.zoneId === config.sauna.zoneId)!;
  const walls: WallId[] = [room.walls.S, room.walls.N, room.walls.west, room.walls.east];
  const wallLabel = (w: WallId) => t(`wall.${w}` as I18nKey);
  const h = config.sauna.heater;
  const heater = cat.heaters.find((x) => x.sku === h.sku);
  const along: [number, number] = h.wall === room.walls.S || h.wall === room.walls.N ? [room.box.min[0], room.box.max[0]] : [room.box.min[1], room.box.max[1]];
  const half = (heater?.size.w_mm ?? 400) / 2;
  const suitable = new Set(ev.sauna.suitableHeaters);
  const b = config.sauna.benches;
  const bench = cat.benchSystems.find((x) => x.sku === b.system);
  const lights = cat.purchased.filter((p) => p.active && p.category === 'light');
  return (
    <>
      <Section title={t('int.cladding')}>
        <Choice
          name="interior"
          cards
          value={config.sauna.interiorCladding}
          onChange={(v) => edit((d) => (d.sauna.interiorCladding = v))}
          options={cat.panels.filter((p) => p.active && p.role === 'interior_cladding').map((p) => ({ value: p.sku, label: tx(p.name) }))}
        />
      </Section>
      <Section title={t('int.benches')}>
        <Choice name="benchLayout" value={b.layout} onChange={(v) => edit((d) => (d.sauna.benches.layout = v))} options={[{ value: 'straight', label: t('int.straight') }, { value: 'L', label: t('int.L') }]} />
        <Choice
          name="levels"
          value={b.levels}
          onChange={(v) => edit((d) => (d.sauna.benches.levels = v))}
          options={([2, 3] as const).filter((n) => (bench?.levels.length ?? 3) >= n).map((n) => ({ value: n, label: `${t('int.levels')}: ${n}` }))}
        />
        <Select name="benchWall" label={t('int.benchWall')} value={b.wall} onChange={(v) => edit((d) => (d.sauna.benches.wall = v))} options={walls.map((w) => ({ value: w, label: wallLabel(w) }))} />
      </Section>
      <Section title={t('int.heater')}>
        <p class="muted">{t('int.volume', { v: num(ev.sauna.eqVolume_m3, 1) })}</p>
        <Choice
          name="heater"
          cards
          value={h.sku}
          onChange={(v) => edit((d) => (d.sauna.heater.sku = v))}
          options={cat.heaters
            .filter((x) => x.active)
            .map((x) => ({
              value: x.sku,
              label: tx(x.name),
              hint: suitable.has(x.sku)
                ? `${t(x.fuel === 'wood' ? 'int.heater.wood' : 'int.heater.electric')} · ${t('int.heater.spec', { kw: num(x.power_kw), min: num(x.volume_min_m3), max: num(x.volume_max_m3) })}`
                : t('int.heater.unsuitable', { v: num(ev.sauna.eqVolume_m3, 1) }),
              disabled: !suitable.has(x.sku) && x.sku !== h.sku,
            }))}
        />
        <Select name="heaterWall" label={t('int.heaterWall')} value={h.wall} onChange={(v) => edit((d) => (d.sauna.heater = { ...d.sauna.heater, wall: v, along_mm: Number.NaN }))} options={walls.map((w) => ({ value: w, label: wallLabel(w) }))} />
        <Slider
          name="heaterPos"
          label={t('int.heaterPos')}
          value={h.along_mm}
          min={Math.ceil(along[0] + half)}
          max={Math.floor(along[1] - half)}
          step={10}
          display={`${m(h.along_mm - along[0], 2)} m`}
          onChange={(v) => edit((d) => (d.sauna.heater.along_mm = v))}
        />
      </Section>
      <Section title={t('int.lighting')}>
        {lights.map((l) => {
          const item = config.sauna.lighting.find((x) => x.sku === l.sku);
          return (
            <div class="row" key={l.sku}>
              <Check
                name={`light-${l.sku}`}
                label={tx(l.name)}
                checked={!!item}
                onChange={(on) =>
                  edit((d) => {
                    d.sauna.lighting = d.sauna.lighting.filter((x) => x.sku !== l.sku);
                    if (on) d.sauna.lighting.push({ sku: l.sku, mount: l.size_mm && l.size_mm[0] > 500 ? 'under_bench' : 'ceiling', qty: 1 });
                  })
                }
              />
              {item && (
                <Select
                  name={`mount-${l.sku}`}
                  label=""
                  value={item.mount}
                  onChange={(v) => edit((d) => (d.sauna.lighting.find((x) => x.sku === l.sku)!.mount = v))}
                  options={(['under_bench', 'backrest', 'ceiling', 'wall'] as const).map((x) => ({ value: x, label: t(`mount.${x}`) }))}
                />
              )}
            </div>
          );
        })}
      </Section>
    </>
  );
}
