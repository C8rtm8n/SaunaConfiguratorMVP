import type { Currency, FactValue, I18nText, Locale } from '@sauna/core';

/** UI strings. Catalog texts come from the catalog (I18nText). Fallback: locale → en → cs. */
const cs = {
  'app.title': 'Konfigurátor sauny',
  'step.1': 'Modul',
  'step.2': 'Dispozice',
  'step.3': 'Otvory',
  'step.4': 'Exteriér',
  'step.5': 'Interiér',
  'step.6': 'Terasa a doplňky',
  'step.7': 'Osazení',
  'step.8': 'Souhrn a poptávka',
  'nav.back': 'Zpět',
  'nav.next': 'Pokračovat',
  'price.label': 'Orientační cena',
  'price.hidden': 'Cena na dotaz',
  'price.range': '{from} – {to}',
  'price.exVat': 'bez DPH, vč. dopravy',
  'warn.none': 'Konfigurace je v pořádku',
  'warn.count': 'Chyby: {errors} · upozornění: {warnings}',
  'warn.fix': 'Opravit',
  'warn.title': 'Kontrola konfigurace',
  'auto.title': 'Automaticky doplněno',
  'viewer.section': 'Řez',
  'viewer.loading': 'Načítám 3D…',
  'viewer.hint': 'Tažením otáčíte, kolečkem / dvěma prsty přibližujete.',
  // step 1
  'module.custom': 'Ocelový rám na míru',
  'module.custom.desc': 'Délka {min}–{max} m po {step} m, šířka {widths} m, výška {h} m',
  'module.iso': 'Kontejner ISO 20′ HC',
  'module.iso.desc': 'Pevné rozměry {l} × {w} × {h} m',
  'module.length': 'Délka',
  'module.width': 'Šířka',
  'module.dims': 'Vnější rozměry {l} × {w} × {h} m',
  // step 2
  'layout.one': 'Jen sauna',
  'layout.two': 'Sauna + převlékárna',
  'layout.saunaSide': 'Sauna je',
  'layout.west': 'vlevo',
  'layout.east': 'vpravo',
  'layout.partition': 'Poloha příčky',
  'layout.sauna': 'Sauna {l} m',
  'layout.changing': 'Převlékárna {l} m',
  // step 3
  'openings.wall': 'Stěna',
  'wall.S': 'Přední',
  'wall.N': 'Zadní',
  'wall.W': 'Levé čelo',
  'wall.E': 'Pravé čelo',
  'wall.P1': 'Příčka',
  'wall.roof': 'Střecha',
  'openings.product': 'Prvek',
  'openings.hint': 'Vyberte prvek a klikněte do volného slotu (i ve 3D).',
  'openings.remove': 'Odebrat',
  'openings.hinge': 'Panty',
  'openings.hinge.left': 'vlevo',
  'openings.hinge.right': 'vpravo',
  'openings.slots': 'šíře {n} × slot',
  'openings.err.occupied': 'Slot je obsazený.',
  'openings.err.too_wide': 'Prvek se na tuto stěnu nevejde.',
  'openings.err.no_wall': 'Tato stěna v dispozici není.',
  'openings.err.unknown_product': 'Prvek nelze použít.',
  'openings.selected': 'Vybraný otvor',
  'type.window': 'Okno',
  'type.panorama': 'Panorama',
  'type.glass_front': 'Prosklené čelo',
  'type.door': 'Dveře',
  'type.vent': 'Mřížka',
  // step 4
  'ext.cladding': 'Obklad',
  'ext.orientation': 'Orientace lamel',
  'ext.vertical': 'svisle',
  'ext.horizontal': 'vodorovně',
  'ext.roof': 'Střešní krytina',
  // step 5
  'int.cladding': 'Vnitřní obklad',
  'int.benches': 'Lavice',
  'int.straight': 'rovná',
  'int.L': 'do L',
  'int.levels': 'Úrovně',
  'int.benchWall': 'U stěny',
  'int.heater': 'Kamna',
  'int.heater.wood': 'na dřevo',
  'int.heater.electric': 'elektrická',
  'int.heater.spec': '{kw} kW · {min}–{max} m³',
  'int.heater.unsuitable': 'Nevhodná pro objem {v} m³',
  'int.heaterWall': 'Kamna u stěny',
  'int.heaterPos': 'Poloha kamen',
  'int.volume': 'Ekvivalentní objem sauny {v} m³',
  'int.lighting': 'Osvětlení',
  'mount.under_bench': 'pod lavicí',
  'mount.backrest': 'za zády',
  'mount.ceiling': 'strop',
  'mount.wall': 'stěna',
  // step 6
  'terrace.title': 'Terasa',
  'terrace.none': 'bez terasy',
  'terrace.front': 'čelní',
  'terrace.side': 'boční',
  'terrace.depth': 'Hloubka',
  'terrace.railing': 'Zábradlí',
  'terrace.stairs': 'Schody',
  'overhang.title': 'Přesah střechy',
  'overhang.none': 'bez přesahu',
  // step 7
  'found.pads': 'Betonové patky',
  'found.screws': 'Zemní vruty',
  'found.beams': 'Ocelové pražce',
  'found.points': '{n} podpěr, max. {kn} kN na podpěru',
  // step 8
  'sum.title': 'Vaše sauna',
  'sum.module': 'Modul',
  'sum.layout': 'Dispozice',
  'sum.openings': 'Otvory',
  'sum.exterior': 'Exteriér',
  'sum.interior': 'Interiér',
  'sum.extras': 'Doplňky',
  'sum.foundation': 'Osazení',
  'sum.transport': 'Doprava',
  'sum.transport.oversize': 'nadrozměrná přeprava',
  'sum.transport.normal': 'běžná přeprava',
  'form.title': 'Nezávazná poptávka',
  'form.name': 'Jméno a příjmení',
  'form.email': 'E-mail',
  'form.phone': 'Telefon',
  'form.postalCode': 'PSČ místa osazení',
  'form.term': 'Požadovaný termín',
  'form.budget': 'Rozpočet',
  'form.note': 'Poznámka',
  'form.photo': 'Foto místa (nepovinné)',
  'form.consent': 'Souhlasím se zpracováním osobních údajů za účelem vyřízení poptávky.',
  'form.submit': 'Odeslat poptávku',
  'form.blocked': 'Před odesláním opravte chyby v konfiguraci.',
  'form.invalid': 'Vyplňte povinná pole.',
  'form.sent': 'Děkujeme! Poptávka {id} byla odeslána. Ozveme se vám.',
  'form.error': 'Odeslání se nezdařilo, zkuste to prosím znovu.',
  'form.photo.tooBig': 'Fotka je větší než {mb} MB.',
  'share.save': 'Uložit a sdílet',
  'share.copied': 'Odkaz zkopírován',
  'share.link': 'Odkaz na konfiguraci',
  'load.error': 'Uloženou konfiguraci se nepodařilo načíst, začínáme znovu.',
  'unit.m': 'm',
};

type Key = keyof typeof cs;

const de: Partial<Record<Key, string>> = {
  'app.title': 'Sauna-Konfigurator',
  'step.1': 'Modul', 'step.2': 'Grundriss', 'step.3': 'Öffnungen', 'step.4': 'Außen', 'step.5': 'Innen', 'step.6': 'Terrasse & Extras', 'step.7': 'Fundament', 'step.8': 'Übersicht & Anfrage',
  'nav.back': 'Zurück', 'nav.next': 'Weiter',
  'price.label': 'Richtpreis', 'price.hidden': 'Preis auf Anfrage', 'price.exVat': 'zzgl. MwSt., inkl. Transport',
  'warn.none': 'Konfiguration ist in Ordnung', 'warn.count': 'Fehler: {errors} · Hinweise: {warnings}', 'warn.fix': 'Beheben', 'warn.title': 'Prüfung', 'auto.title': 'Automatisch ergänzt',
  'viewer.section': 'Schnitt', 'viewer.loading': '3D wird geladen…', 'viewer.hint': 'Ziehen zum Drehen, Mausrad / zwei Finger zum Zoomen.',
  'module.custom': 'Stahlrahmen nach Maß', 'module.custom.desc': 'Länge {min}–{max} m in {step}-m-Schritten, Breite {widths} m, Höhe {h} m',
  'module.iso': 'Container ISO 20′ HC', 'module.iso.desc': 'Feste Maße {l} × {w} × {h} m', 'module.length': 'Länge', 'module.width': 'Breite', 'module.dims': 'Außenmaße {l} × {w} × {h} m',
  'layout.one': 'Nur Sauna', 'layout.two': 'Sauna + Umkleide', 'layout.saunaSide': 'Sauna liegt', 'layout.west': 'links', 'layout.east': 'rechts', 'layout.partition': 'Lage der Trennwand', 'layout.sauna': 'Sauna {l} m', 'layout.changing': 'Umkleide {l} m',
  'openings.wall': 'Wand', 'wall.S': 'Vorne', 'wall.N': 'Hinten', 'wall.W': 'Stirn links', 'wall.E': 'Stirn rechts', 'wall.P1': 'Trennwand', 'wall.roof': 'Dach',
  'openings.product': 'Element', 'openings.hint': 'Element wählen und in einen freien Slot klicken (auch in 3D).', 'openings.remove': 'Entfernen', 'openings.hinge': 'Bänder', 'openings.hinge.left': 'links', 'openings.hinge.right': 'rechts', 'openings.slots': 'Breite {n} × Slot',
  'openings.err.occupied': 'Slot ist belegt.', 'openings.err.too_wide': 'Element passt nicht auf diese Wand.', 'openings.err.no_wall': 'Diese Wand gibt es nicht.', 'openings.err.unknown_product': 'Element nicht verfügbar.', 'openings.selected': 'Gewählte Öffnung',
  'type.window': 'Fenster', 'type.panorama': 'Panorama', 'type.glass_front': 'Glasfront', 'type.door': 'Tür', 'type.vent': 'Lüftungsgitter',
  'ext.cladding': 'Fassade', 'ext.orientation': 'Lamellen', 'ext.vertical': 'senkrecht', 'ext.horizontal': 'waagerecht', 'ext.roof': 'Dachdeckung',
  'int.cladding': 'Innenverkleidung', 'int.benches': 'Bänke', 'int.straight': 'gerade', 'int.L': 'L-Form', 'int.levels': 'Stufen', 'int.benchWall': 'An Wand', 'int.heater': 'Ofen', 'int.heater.wood': 'Holz', 'int.heater.electric': 'elektrisch', 'int.heater.unsuitable': 'Ungeeignet für {v} m³', 'int.heaterWall': 'Ofen an Wand', 'int.heaterPos': 'Ofenposition', 'int.volume': 'Äquivalentes Saunavolumen {v} m³', 'int.lighting': 'Beleuchtung',
  'mount.under_bench': 'unter der Bank', 'mount.backrest': 'Rückenlehne', 'mount.ceiling': 'Decke', 'mount.wall': 'Wand',
  'terrace.title': 'Terrasse', 'terrace.none': 'ohne', 'terrace.front': 'Stirnseite', 'terrace.side': 'seitlich', 'terrace.depth': 'Tiefe', 'terrace.railing': 'Geländer', 'terrace.stairs': 'Treppe', 'overhang.title': 'Dachüberstand', 'overhang.none': 'ohne',
  'found.pads': 'Betonfundamente', 'found.screws': 'Schraubfundamente', 'found.beams': 'Stahlschwellen', 'found.points': '{n} Auflager, max. {kn} kN je Auflager',
  'sum.title': 'Ihre Sauna', 'sum.module': 'Modul', 'sum.layout': 'Grundriss', 'sum.openings': 'Öffnungen', 'sum.exterior': 'Außen', 'sum.interior': 'Innen', 'sum.extras': 'Extras', 'sum.foundation': 'Fundament', 'sum.transport': 'Transport', 'sum.transport.oversize': 'Sondertransport', 'sum.transport.normal': 'Standardtransport',
  'form.title': 'Unverbindliche Anfrage', 'form.name': 'Name', 'form.email': 'E-Mail', 'form.phone': 'Telefon', 'form.postalCode': 'PLZ des Aufstellorts', 'form.term': 'Wunschtermin', 'form.budget': 'Budget', 'form.note': 'Anmerkung', 'form.photo': 'Foto des Standorts (optional)',
  'form.consent': 'Ich stimme der Verarbeitung meiner Daten zur Bearbeitung der Anfrage zu.', 'form.submit': 'Anfrage senden', 'form.blocked': 'Bitte zuerst die Fehler beheben.', 'form.invalid': 'Bitte Pflichtfelder ausfüllen.', 'form.sent': 'Danke! Anfrage {id} wurde gesendet.', 'form.error': 'Senden fehlgeschlagen, bitte erneut versuchen.', 'form.photo.tooBig': 'Foto ist größer als {mb} MB.',
  'share.save': 'Speichern & teilen', 'share.copied': 'Link kopiert', 'share.link': 'Link zur Konfiguration', 'load.error': 'Gespeicherte Konfiguration nicht gefunden, neuer Start.',
};

const en: Partial<Record<Key, string>> = {
  'app.title': 'Sauna configurator',
  'step.1': 'Module', 'step.2': 'Layout', 'step.3': 'Openings', 'step.4': 'Exterior', 'step.5': 'Interior', 'step.6': 'Terrace & extras', 'step.7': 'Foundation', 'step.8': 'Summary & enquiry',
  'nav.back': 'Back', 'nav.next': 'Continue',
  'price.label': 'Indicative price', 'price.hidden': 'Price on request', 'price.exVat': 'excl. VAT, incl. delivery',
  'warn.none': 'Configuration is fine', 'warn.count': 'Errors: {errors} · warnings: {warnings}', 'warn.fix': 'Fix', 'warn.title': 'Checks', 'auto.title': 'Added automatically',
  'viewer.section': 'Section', 'viewer.loading': 'Loading 3D…', 'viewer.hint': 'Drag to orbit, wheel / pinch to zoom.',
  'module.custom': 'Custom steel frame', 'module.custom.desc': 'Length {min}–{max} m in {step} m steps, width {widths} m, height {h} m',
  'module.iso': 'ISO 20′ HC container', 'module.iso.desc': 'Fixed size {l} × {w} × {h} m', 'module.length': 'Length', 'module.width': 'Width', 'module.dims': 'Outside {l} × {w} × {h} m',
  'layout.one': 'Sauna only', 'layout.two': 'Sauna + changing room', 'layout.saunaSide': 'Sauna on the', 'layout.west': 'left', 'layout.east': 'right', 'layout.partition': 'Partition position', 'layout.sauna': 'Sauna {l} m', 'layout.changing': 'Changing room {l} m',
  'openings.wall': 'Wall', 'wall.S': 'Front', 'wall.N': 'Back', 'wall.W': 'Left end', 'wall.E': 'Right end', 'wall.P1': 'Partition', 'wall.roof': 'Roof',
  'openings.product': 'Element', 'openings.hint': 'Pick an element and click a free slot (also in 3D).', 'openings.remove': 'Remove', 'openings.hinge': 'Hinges', 'openings.hinge.left': 'left', 'openings.hinge.right': 'right', 'openings.slots': 'width {n} × slot',
  'openings.err.occupied': 'Slot is occupied.', 'openings.err.too_wide': 'Element does not fit this wall.', 'openings.err.no_wall': 'This wall does not exist.', 'openings.err.unknown_product': 'Element not available.', 'openings.selected': 'Selected opening',
  'type.window': 'Window', 'type.panorama': 'Panorama', 'type.glass_front': 'Glass front', 'type.door': 'Door', 'type.vent': 'Vent',
  'ext.cladding': 'Cladding', 'ext.orientation': 'Boards', 'ext.vertical': 'vertical', 'ext.horizontal': 'horizontal', 'ext.roof': 'Roofing',
  'int.cladding': 'Interior lining', 'int.benches': 'Benches', 'int.straight': 'straight', 'int.L': 'L-shaped', 'int.levels': 'Levels', 'int.benchWall': 'On wall', 'int.heater': 'Heater', 'int.heater.wood': 'wood', 'int.heater.electric': 'electric', 'int.heater.unsuitable': 'Not suitable for {v} m³', 'int.heaterWall': 'Heater wall', 'int.heaterPos': 'Heater position', 'int.volume': 'Equivalent sauna volume {v} m³', 'int.lighting': 'Lighting',
  'mount.under_bench': 'under bench', 'mount.backrest': 'backrest', 'mount.ceiling': 'ceiling', 'mount.wall': 'wall',
  'terrace.title': 'Terrace', 'terrace.none': 'none', 'terrace.front': 'front', 'terrace.side': 'side', 'terrace.depth': 'Depth', 'terrace.railing': 'Railing', 'terrace.stairs': 'Stairs', 'overhang.title': 'Roof overhang', 'overhang.none': 'none',
  'found.pads': 'Concrete pads', 'found.screws': 'Ground screws', 'found.beams': 'Steel skids', 'found.points': '{n} supports, max. {kn} kN per support',
  'sum.title': 'Your sauna', 'sum.module': 'Module', 'sum.layout': 'Layout', 'sum.openings': 'Openings', 'sum.exterior': 'Exterior', 'sum.interior': 'Interior', 'sum.extras': 'Extras', 'sum.foundation': 'Foundation', 'sum.transport': 'Delivery', 'sum.transport.oversize': 'oversize transport', 'sum.transport.normal': 'standard transport',
  'form.title': 'Free enquiry', 'form.name': 'Full name', 'form.email': 'E-mail', 'form.phone': 'Phone', 'form.postalCode': 'Site postal code', 'form.term': 'Preferred date', 'form.budget': 'Budget', 'form.note': 'Note', 'form.photo': 'Site photo (optional)',
  'form.consent': 'I agree to the processing of my personal data to handle this enquiry.', 'form.submit': 'Send enquiry', 'form.blocked': 'Please fix the configuration errors first.', 'form.invalid': 'Please fill in the required fields.', 'form.sent': 'Thank you! Enquiry {id} has been sent.', 'form.error': 'Sending failed, please try again.', 'form.photo.tooBig': 'Photo is larger than {mb} MB.',
  'share.save': 'Save & share', 'share.copied': 'Link copied', 'share.link': 'Configuration link', 'load.error': 'Saved configuration not found, starting fresh.',
};

const DICTS: Record<Locale, Partial<Record<Key, string>>> = { cs, de, en };
export type { Key as I18nKey };

export interface I18n {
  locale: Locale;
  t(key: Key, params?: Record<string, string | number>): string;
  /** Catalog text in the current locale. */
  tx(text: I18nText): string;
  /** Rule message template with params (numbers formatted). */
  msg(text: I18nText, params: Record<string, FactValue>): string;
  num(v: number, digits?: number): string;
  /** mm → "4,2" (m). */
  m(mm: number, digits?: number): string;
  money(czk: number, currency: Currency, eurPerCzk: number, step: number): string;
}

const fill = (s: string, p: Record<string, string | number> = {}) => s.replace(/\{([^}]+)\}/g, (_, k: string) => (p[k] !== undefined ? String(p[k]) : `{${k}}`));

export function createI18n(locale: Locale): I18n {
  const nf = (d: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const num = (v: number, digits = 1) => nf(digits).format(v);
  const pick = (text: I18nText) => text[locale] ?? text.en ?? text.cs;
  return {
    locale,
    t: (key, params) => fill(DICTS[locale][key] ?? en[key] ?? cs[key], params),
    tx: pick,
    msg: (text, params) =>
      fill(
        pick(text),
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v === null ? '–' : typeof v === 'number' ? num(v, 2) : String(v)])),
      ),
    num,
    m: (mm, digits = 2) => num(mm / 1000, digits),
    money(czk, currency, eurPerCzk, step) {
      const v = currency === 'EUR' ? czk * eurPerCzk : czk;
      const s = currency === 'EUR' ? 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, step * eurPerCzk)))) : step;
      return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.round(v / s) * s);
    },
  };
}
