import { setOverhang, setTerrace, type ExteriorWallId, type TerraceAttachment } from '@sauna/core';
import { useApp } from '../state.js';
import { Check, Choice, Section, Select } from '../components/ui.js';
import type { I18nKey } from '../i18n.js';

export function Step6Extras() {
  const { config, tenant, i18n, setConfig } = useApp();
  const { t, m } = i18n;
  const cat = tenant.catalog;
  const terrace = config.attachments.find((a): a is TerraceAttachment => a.type === 'terrace');
  const kind = !terrace ? 'none' : terrace.wall === 'E' ? 'front' : 'side';
  const railing = config.attachments.some((a) => a.type === 'railing');
  const stairs = config.attachments.some((a) => a.type === 'stairs');
  const sys = cat.attachmentSystems.find((a) => a.active && a.type === 'terrace');
  const ovSys = cat.attachmentSystems.find((a) => a.active && a.type === 'roof_overhang');
  const overhang = config.attachments.find((a) => a.type === 'roof_overhang');
  const apply = (k: 'none' | 'front' | 'side', o: { depth_mm?: number; railing?: boolean; stairs?: boolean } = {}) =>
    setConfig(setTerrace(config, cat, k, { depth_mm: o.depth_mm ?? terrace?.depth_mm, railing: o.railing ?? railing, stairs: o.stairs ?? stairs }));
  return (
    <>
      {sys && (
        <Section title={t('terrace.title')}>
          <Choice
            name="terrace"
            cards
            value={kind}
            onChange={(k) => apply(k)}
            options={[
              { value: 'none', label: t('terrace.none') },
              { value: 'front', label: t('terrace.front') },
              { value: 'side', label: t('terrace.side') },
            ]}
          />
          {terrace && (
            <>
              <Choice name="terraceDepth" value={terrace.depth_mm} onChange={(v) => apply(kind, { depth_mm: v })} options={(sys.allowedDepths_mm ?? []).map((d) => ({ value: d, label: `${t('terrace.depth')} ${m(d, 1)} m` }))} />
              <Check name="railing" label={t('terrace.railing')} checked={railing} onChange={(v) => apply(kind, { railing: v })} />
              <Check name="stairs" label={t('terrace.stairs')} checked={stairs} onChange={(v) => apply(kind, { stairs: v })} />
            </>
          )}
        </Section>
      )}
      {ovSys && (
        <Section title={t('overhang.title')}>
          <Select
            name="overhang"
            label=""
            value={overhang?.type === 'roof_overhang' ? overhang.wall : 'none'}
            onChange={(v) => setConfig(setOverhang(config, cat, v === 'none' ? null : (v as ExteriorWallId)))}
            options={[{ value: 'none', label: t('overhang.none') }, ...(['S', 'N', 'W', 'E'] as const).map((w) => ({ value: w, label: t(`wall.${w}` as I18nKey) }))]}
          />
        </Section>
      )}
    </>
  );
}
