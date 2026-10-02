import { useApp } from '../state.js';
import { Choice, Section, Slider } from '../components/ui.js';

export function Step1Module() {
  const { config, tenant, i18n, edit } = useApp();
  const mo = tenant.catalog.modules;
  const cont = tenant.catalog.containers.find((c) => c.sku === mo.iso_20hc.container);
  const cf = mo.custom_frame;
  const { t, m } = i18n;
  return (
    <>
      <Section title={t('step.1')}>
        <Choice
          name="module"
          cards
          value={config.module.type}
          onChange={(type) => edit((d) => (d.module.type = type))}
          options={[
            {
              value: 'custom_frame',
              label: t('module.custom'),
              hint: t('module.custom.desc', { min: m(cf.length_mm.min, 1), max: m(cf.length_mm.max, 1), step: m(cf.length_mm.step, 1), widths: cf.widths_mm.map((w) => m(w)).join(' / '), h: m(cf.height_mm, 1) }),
            },
            ...(cont ? [{ value: 'iso_20hc' as const, label: t('module.iso'), hint: t('module.iso.desc', { l: m(cont.L_mm), w: m(cont.W_mm), h: m(cont.H_mm) }) }] : []),
          ]}
        />
      </Section>
      {config.module.type === 'custom_frame' && (
        <Section title={t('module.dims', { l: m(config.module.L_mm, 1), w: m(config.module.W_mm), h: m(config.module.H_mm, 1) })}>
          <Slider
            name="length"
            label={t('module.length')}
            value={config.module.L_mm}
            min={cf.length_mm.min}
            max={cf.length_mm.max}
            step={cf.length_mm.step}
            display={`${m(config.module.L_mm, 1)} m`}
            onChange={(v) => edit((d) => (d.module.L_mm = v))}
          />
          <Choice name="width" value={config.module.W_mm} onChange={(v) => edit((d) => (d.module.W_mm = v))} options={cf.widths_mm.map((w) => ({ value: w, label: `${m(w)} m` }))} />
        </Section>
      )}
    </>
  );
}
