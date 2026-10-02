import { useApp } from '../state.js';
import { Choice, Section } from '../components/ui.js';

export function Step7Foundation() {
  const { config, tenant, i18n, edit, ev } = useApp();
  const { t, tx, num } = i18n;
  const types = tenant.catalog.foundations.filter((f) => f.active);
  const max = Math.max(...ev.supports.points.map((p) => p.R_kN));
  return (
    <Section title={t('step.7')}>
      <Choice
        name="foundation"
        cards
        value={config.foundation}
        onChange={(v) => edit((d) => (d.foundation = v))}
        options={types.map((f) => ({ value: f.type, label: tx(f.name) }))}
      />
      <p class="muted">{t('found.points', { n: ev.supports.points.length, kn: num(max, 1) })}</p>
    </Section>
  );
}
