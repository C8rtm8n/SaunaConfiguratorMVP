import { useEffect, useState } from 'preact/hooks';
import { addOpening, removeOpening, type WallId } from '@sauna/core';
import { useApp } from '../state.js';
import { Choice, Section } from '../components/ui.js';
import { WallSlots } from '../components/WallSlots.js';
import type { I18nKey } from '../i18n.js';

export function Step3Openings() {
  const app = useApp();
  const { config, tenant, i18n, ev, wall, setWall, slotClick, setSlotClick, setHighlight } = app;
  const { t, tx } = i18n;
  const cat = tenant.catalog;
  const products = cat.openings.filter((o) => o.active && o.moduleTypes.includes(config.module.type) && (o.fullWall || o.slots[config.module.grid_mm]));
  const [sku, setSku] = useState(products.find((p) => p.type === 'window')?.sku ?? products[0]?.sku ?? '');
  const [selected, setSelected] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const walls: WallId[] = ['S', 'N', 'W', 'E', ...ev.geometry.partitions.map((p) => p.id)];
  const w = walls.includes(wall) ? wall : 'S';
  const layout = ev.slots[w]!;
  const sel = config.openings.find((o) => o.id === selected);

  const placeAt = (index: number) => {
    const hit = config.openings.find((o) => o.wall === w && index >= o.slotFrom && index <= o.slotTo);
    if (hit) return setSelected(hit.id);
    const r = addOpening(config, cat, w, index, sku);
    if (r.error) return setError(t(`openings.err.${r.error}` as I18nKey));
    setError(null);
    app.setConfig(r.config);
    setSelected(r.openingId);
  };

  // Clicks in the 3D view (wall + slot) arrive via app.slotClick.
  useEffect(() => {
    if (!slotClick || slotClick.wall === 'roof') return;
    setSlotClick(null);
    if (slotClick.wall !== w) setWall(slotClick.wall);
    const hit = config.openings.find((o) => o.wall === slotClick.wall && slotClick.index >= o.slotFrom && slotClick.index <= o.slotTo);
    if (hit) return setSelected(hit.id);
    const r = addOpening(config, cat, slotClick.wall, slotClick.index, sku);
    if (r.error) return setError(t(`openings.err.${r.error}` as I18nKey));
    setError(null);
    app.setConfig(r.config);
    setSelected(r.openingId);
  }, [slotClick]);

  useEffect(() => {
    setHighlight(sel ? Array.from({ length: sel.slotTo - sel.slotFrom + 1 }, (_, i) => ({ wall: sel.wall, index: sel.slotFrom + i })) : []);
    return () => setHighlight([]);
  }, [sel?.id, sel?.slotFrom, sel?.slotTo, sel?.wall]);

  const label = (o: (typeof config.openings)[number]) => t(`type.${o.type}` as I18nKey);
  return (
    <>
      <Section title={t('openings.product')}>
        <Choice
          name="product"
          cards
          value={sku}
          onChange={setSku}
          options={products.map((p) => ({ value: p.sku, label: tx(p.name), hint: p.fullWall ? t('type.glass_front') : t('openings.slots', { n: p.slots[config.module.grid_mm] ?? 0 }) }))}
        />
        <p class="muted">{t('openings.hint')}</p>
      </Section>
      <Section title={t('openings.wall')}>
        <Choice name="wall" value={w} onChange={(v) => setWall(v)} options={walls.map((x) => ({ value: x, label: t(`wall.${x}` as I18nKey) }))} />
        <WallSlots layout={layout} openings={config.openings.filter((o) => o.wall === w)} selected={selected} label={label} onSlot={placeAt} onOpening={setSelected} />
        {error && <p class="err" role="alert">{error}</p>}
      </Section>
      {sel && (
        <Section title={`${t('openings.selected')}: ${label(sel)} (${t(`wall.${sel.wall}` as I18nKey)} ${sel.slotFrom + 1}–${sel.slotTo + 1})`}>
          {sel.door && (
            <Choice
              name="hinge"
              value={sel.door.hinge}
              onChange={(h) => app.edit((d) => (d.openings.find((o) => o.id === sel.id)!.door!.hinge = h))}
              options={[
                { value: 'left', label: `${t('openings.hinge')} ${t('openings.hinge.left')}` },
                { value: 'right', label: `${t('openings.hinge')} ${t('openings.hinge.right')}` },
              ]}
            />
          )}
          <button
            type="button"
            class="btn ghost"
            onClick={() => {
              app.setConfig(removeOpening(config, sel.id));
              setSelected(undefined);
            }}
          >
            {t('openings.remove')}
          </button>
        </Section>
      )}
    </>
  );
}
