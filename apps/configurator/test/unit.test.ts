import { describe, expect, it } from 'vitest';
import { createI18n } from '../src/i18n.js';
import { make, parse } from '@sauna/embed/protocol';

describe('i18n', () => {
  it('falls back de → en → cs and fills params', () => {
    const de = createI18n('de');
    expect(de.t('nav.next')).toBe('Weiter');
    expect(de.t('openings.slots', { n: 2 })).toBe('Breite 2 × Slot');
    expect(createI18n('en').tx({ cs: 'Okno', en: 'Window' })).toBe('Window');
    expect(createI18n('de').tx({ cs: 'Okno', en: 'Window' })).toBe('Window');
  });
  it('money: CZK rounding step, EUR conversion', () => {
    const cs = createI18n('cs');
    expect(cs.money(298_412, 'CZK', 0.04, 1000).replace(/\s/g, ' ')).toBe('298 000 Kč');
    expect(cs.money(298_412, 'EUR', 0.04, 1000).replace(/\s/g, ' ')).toBe('11 940 €');
  });
  it('mm → m', () => {
    expect(createI18n('cs').m(4200, 1)).toBe('4,2');
    expect(createI18n('en').m(2438)).toBe('2.44');
  });
});

describe('embed protocol', () => {
  it('round-trips and rejects foreign messages', () => {
    const m = make<{ resize: { height: number } }, 'resize'>('resize', { height: 800 });
    expect(parse(m)).toEqual(m);
    expect(parse({ type: 'resize' })).toBeNull();
    expect(parse('x')).toBeNull();
    expect(parse({ ...m, v: 2 })).toBeNull();
  });
});
