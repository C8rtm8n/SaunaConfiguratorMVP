import { useApp } from '../state.js';
import { Choice, Section } from '../components/ui.js';

export function Step4Exterior() {
  const { config, tenant, i18n, edit } = useApp();
  const { t, tx } = i18n;
  const panels = tenant.catalog.panels.filter((p) => p.active);
  return (
    <>
      <Section title={t('ext.cladding')}>
        <Choice
          name="cladding"
          cards
          value={config.cladding.exterior}
          onChange={(v) => edit((d) => (d.cladding.exterior = v))}
          options={panels.filter((p) => p.role === 'exterior_cladding').map((p) => ({ value: p.sku, label: tx(p.name) }))}
        />
        <Choice
          name="orientation"
          value={config.cladding.orientation}
          onChange={(v) => edit((d) => (d.cladding.orientation = v))}
          options={[
            { value: 'vertical', label: `${t('ext.orientation')}: ${t('ext.vertical')}` },
            { value: 'horizontal', label: `${t('ext.orientation')}: ${t('ext.horizontal')}` },
          ]}
        />
      </Section>
      <Section title={t('ext.roof')}>
        <Choice name="roof" value={config.cladding.roof} onChange={(v) => edit((d) => (d.cladding.roof = v))} options={panels.filter((p) => p.role === 'roof_covering').map((p) => ({ value: p.sku, label: tx(p.name) }))} />
      </Section>
    </>
  );
}
