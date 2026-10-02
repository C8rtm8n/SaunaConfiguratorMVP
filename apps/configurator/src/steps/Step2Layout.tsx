import { setLayout } from '@sauna/core';
import { useApp } from '../state.js';
import { Choice, Section, Slider } from '../components/ui.js';

export function Step2Layout() {
  const { config, tenant, i18n, setConfig } = useApp();
  const { t, m } = i18n;
  const two = config.zones.length === 2;
  const saunaFirst = config.zones[0]!.type === 'sauna';
  const x = config.zones[0]!.to_mm;
  const L = config.module.L_mm;
  const g = config.module.grid_mm;
  const sauna = config.zones.find((z) => z.type === 'sauna')!;
  const changing = config.zones.find((z) => z.type === 'changing');
  return (
    <Section title={t('step.2')}>
      <Choice
        name="zones"
        cards
        value={two ? 2 : 1}
        onChange={(n) => setConfig(setLayout(config, tenant.catalog, n as 1 | 2, true))}
        options={[
          { value: 1, label: t('layout.one') },
          { value: 2, label: t('layout.two') },
        ]}
      />
      {two && (
        <>
          <Choice
            name="saunaSide"
            value={saunaFirst ? 'w' : 'e'}
            onChange={(v) => setConfig(setLayout(config, tenant.catalog, 2, v === 'w', L - x))}
            options={[
              { value: 'w', label: `${t('layout.saunaSide')} ${t('layout.west')}` },
              { value: 'e', label: `${t('layout.saunaSide')} ${t('layout.east')}` },
            ]}
          />
          <Slider
            name="partition"
            label={t('layout.partition')}
            value={x}
            min={g}
            max={Math.floor((L - 1) / g) * g}
            step={g}
            display={`${m(x, 1)} m`}
            onChange={(v) => setConfig(setLayout(config, tenant.catalog, 2, saunaFirst, v))}
          />
          <p class="muted">
            {t('layout.sauna', { l: m(sauna.to_mm - sauna.from_mm, 1) })} · {changing && t('layout.changing', { l: m(changing.to_mm - changing.from_mm, 1) })}
          </p>
        </>
      )}
    </Section>
  );
}
