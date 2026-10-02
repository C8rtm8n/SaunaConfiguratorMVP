import type { RuleDef } from '../model/rules.js';

/**
 * Default rule set (data). Copied into each tenant catalog; thresholds come
 * from `catalog.limits`, never from here. Message placeholders = finding params.
 */
export const DEFAULT_RULES: RuleDef[] = [
  // ---------------------------------------------------------- shell validity
  {
    id: 'S01', level: 'error', title: { cs: 'Otvory ve slotech', de: 'Öffnungen in Slots', en: 'Openings in slots' },
    check: { kind: 'fn', fn: 'openingsValid' },
    message_i18n: { cs: 'Otvor {opening} není platný.', de: 'Öffnung {opening} ist ungültig.', en: 'Opening {opening} is invalid.' },
    messages: {
      sku: { cs: 'Otvor {opening}: neznámý produkt {sku}.', de: 'Öffnung {opening}: unbekanntes Produkt {sku}.', en: 'Opening {opening}: unknown product {sku}.' },
      type: { cs: 'Otvor {opening}: produkt {sku} není typu {type}.', de: 'Öffnung {opening}: Produkt {sku} ist nicht vom Typ {type}.', en: 'Opening {opening}: product {sku} is not of type {type}.' },
      module: { cs: 'Otvor {opening}: produkt {sku} nelze použít pro tento typ modulu.', de: 'Öffnung {opening}: Produkt {sku} ist für diesen Modultyp nicht zulässig.', en: 'Opening {opening}: product {sku} not allowed for this module type.' },
      wall: { cs: 'Otvor {opening}: stěna {wall} neexistuje.', de: 'Öffnung {opening}: Wand {wall} existiert nicht.', en: 'Opening {opening}: wall {wall} does not exist.' },
      range: { cs: 'Otvor {opening}: sloty mimo stěnu (stěna má {slots} slotů).', de: 'Öffnung {opening}: Slots außerhalb der Wand ({slots} Slots).', en: 'Opening {opening}: slots out of range (wall has {slots}).' },
      fullWall: { cs: 'Otvor {opening}: prosklené čelo musí zabírat všech {slots} slotů stěny.', de: 'Öffnung {opening}: Glasfront muss alle {slots} Slots belegen.', en: 'Opening {opening}: glass front must take all {slots} slots.' },
      grid: { cs: 'Otvor {opening}: produkt není dostupný pro rastr {grid_mm} mm.', de: 'Öffnung {opening}: Produkt im Raster {grid_mm} mm nicht verfügbar.', en: 'Opening {opening}: product not available for grid {grid_mm} mm.' },
      slots: { cs: 'Otvor {opening}: produkt potřebuje {required} slotů, zadáno {actual}.', de: 'Öffnung {opening}: Produkt benötigt {required} Slots, angegeben {actual}.', en: 'Opening {opening}: product needs {required} slots, got {actual}.' },
      fit: { cs: 'Otvor {opening}: šířka {width_mm} mm se nevejde mezi rohové sloupky (volně {clear_mm} mm).', de: 'Öffnung {opening}: Breite {width_mm} mm passt nicht zwischen die Eckstützen ({clear_mm} mm frei).', en: 'Opening {opening}: width {width_mm} mm does not fit between corner posts ({clear_mm} mm clear).' },
      height: { cs: 'Otvor {opening}: výška {height_mm} mm přesahuje strop.', de: 'Öffnung {opening}: Höhe {height_mm} mm über der Decke.', en: 'Opening {opening}: height {height_mm} mm exceeds the ceiling.' },
      overlap: { cs: 'Otvor {opening} se překrývá s otvorem {other}.', de: 'Öffnung {opening} überlappt mit {other}.', en: 'Opening {opening} overlaps {other}.' },
      doorSpec: { cs: 'Dveře {opening}: chybí směr otevírání.', de: 'Tür {opening}: Öffnungsrichtung fehlt.', en: 'Door {opening}: swing is missing.' },
      partition: { cs: 'Otvor {opening} zasahuje do příčky {partition}.', de: 'Öffnung {opening} kollidiert mit Trennwand {partition}.', en: 'Opening {opening} collides with partition {partition}.' },
    },
    fix: { fn: 'none', label_i18n: { cs: 'Upravit sloty', de: 'Slots anpassen', en: 'Adjust slots' } },
  },
  {
    id: 'S02', level: 'error', title: { cs: 'Zóny', de: 'Zonen', en: 'Zones' },
    check: { kind: 'fn', fn: 'zonesValid', params: { types: 'sauna,changing' } },
    message_i18n: { cs: 'Dispozice zón není platná.', de: 'Zonenaufteilung ungültig.', en: 'Invalid zone layout.' },
    messages: {
      grid: { cs: 'Příčka zóny {zone} ({x_mm} mm) není v rastru {grid_mm} mm.', de: 'Trennwand der Zone {zone} ({x_mm} mm) nicht im Raster {grid_mm} mm.', en: 'Partition of zone {zone} ({x_mm} mm) is off the {grid_mm} mm grid.' },
      end: { cs: 'Zóny musí končit na délce modulu {L_mm} mm.', de: 'Zonen müssen bei {L_mm} mm enden.', en: 'Zones must end at module length {L_mm} mm.' },
    },
  },
  {
    id: 'S03', level: 'error', title: { cs: 'Přídavky', de: 'Anbauten', en: 'Attachments' },
    check: { kind: 'fn', fn: 'attachmentsValid' },
    message_i18n: { cs: 'Přídavek {attachment} není platný.', de: 'Anbau {attachment} ist ungültig.', en: 'Attachment {attachment} is invalid.' },
    messages: {
      depth: { cs: 'Přídavek {attachment}: hloubka {depth_mm} mm není povolena ({allowed}).', de: 'Anbau {attachment}: Tiefe {depth_mm} mm nicht zulässig ({allowed}).', en: 'Attachment {attachment}: depth {depth_mm} mm not allowed ({allowed}).' },
      edge: { cs: 'Přídavek {attachment}: hrana {edge} není volná hrana terasy.', de: 'Anbau {attachment}: Kante {edge} ist keine freie Terrassenkante.', en: 'Attachment {attachment}: edge {edge} is not a free terrace edge.' },
    },
  },
  {
    id: 'S10', level: 'error', title: { cs: 'Umístění v sauně', de: 'Platzierung in der Sauna', en: 'Sauna placement' },
    check: { kind: 'fn', fn: 'saunaPlacement' },
    message_i18n: { cs: 'Neplatné umístění prvku v sauně.', de: 'Ungültige Platzierung in der Sauna.', en: 'Invalid placement in the sauna.' },
    messages: {
      zone: { cs: 'Zóna {zone} neexistuje nebo není sauna.', de: 'Zone {zone} existiert nicht oder ist keine Sauna.', en: 'Zone {zone} missing or not a sauna.' },
      heaterWall: { cs: 'Kamna stojí u stěny {wall}, která neohraničuje saunu.', de: 'Ofen an Wand {wall}, die die Sauna nicht begrenzt.', en: 'Heater is on wall {wall}, which does not bound the sauna.' },
      heaterAlong: { cs: 'Kamna ({along_mm} mm) přesahují stěnu.', de: 'Ofen ({along_mm} mm) ragt über die Wand.', en: 'Heater ({along_mm} mm) extends beyond the wall.' },
      benchWall: { cs: 'Lavice u stěny {wall}, která neohraničuje saunu.', de: 'Bank an Wand {wall} außerhalb der Sauna.', en: 'Bench on wall {wall} outside the sauna.' },
      returnWall: { cs: 'Lavice do L: vratná stěna {wall} musí být kolmá na hlavní.', de: 'L-Bank: Rückwand {wall} muss senkrecht sein.', en: 'L bench: return wall {wall} must be perpendicular.' },
    },
  },

  // ------------------------------------------------------------- sauna R01–R10
  {
    id: 'R01', level: 'error', title: { cs: 'Objem sauny vs. kamna', de: 'Saunavolumen vs. Ofen', en: 'Sauna volume vs heater' },
    check: { kind: 'expr', assert: { op: 'between', a: { fact: 'sauna.eqVolume_m3' }, min: { fact: 'heater.volume_min_m3' }, max: { fact: 'heater.volume_max_m3' } } },
    message_i18n: {
      cs: 'Ekvivalentní objem sauny {sauna.eqVolume_m3} m³ je mimo rozsah kamen {heater.volume_min_m3}–{heater.volume_max_m3} m³.',
      de: 'Äquivalentes Saunavolumen {sauna.eqVolume_m3} m³ liegt außerhalb des Ofenbereichs {heater.volume_min_m3}–{heater.volume_max_m3} m³.',
      en: 'Equivalent sauna volume {sauna.eqVolume_m3} m³ is outside the heater range {heater.volume_min_m3}–{heater.volume_max_m3} m³.',
    },
    fix: { fn: 'suitableHeater', label_i18n: { cs: 'Vybrat vhodná kamna', de: 'Passenden Ofen wählen', en: 'Pick a suitable heater' } },
    source: 'zadání MVP, pravidlo 1',
  },
  {
    id: 'R02', level: 'error', title: { cs: 'Odstupy kamen', de: 'Ofenabstände', en: 'Heater clearances' },
    check: { kind: 'fn', fn: 'heaterClearance' },
    message_i18n: { cs: 'Kolizní obal kamen koliduje.', de: 'Sicherheitsabstand des Ofens verletzt.', en: 'Heater clearance envelope collides.' },
    messages: {
      wall: { cs: 'Kamna nedodrží boční/přední odstup od stěny {wall}.', de: 'Ofen hält den Abstand zur Wand {wall} nicht ein.', en: 'Heater violates clearance to wall {wall}.' },
      ceiling: { cs: 'Kamna nedodrží odstup od stropu: {gap_mm} mm, potřeba {required_mm} mm.', de: 'Deckenabstand {gap_mm} mm, benötigt {required_mm} mm.', en: 'Ceiling clearance {gap_mm} mm, required {required_mm} mm.' },
      bench: { cs: 'Kolizní obal kamen zasahuje do lavice {bench}.', de: 'Sicherheitsabstand des Ofens überlappt Bank {bench}.', en: 'Heater clearance overlaps bench {bench}.' },
      glass: { cs: 'Kolizní obal kamen zasahuje do skla {opening}.', de: 'Sicherheitsabstand des Ofens überlappt Glas {opening}.', en: 'Heater clearance overlaps glass {opening}.' },
      door: { cs: 'Kolizní obal kamen zasahuje do prostoru dveří {opening}.', de: 'Sicherheitsabstand des Ofens überlappt Tür {opening}.', en: 'Heater clearance overlaps door {opening}.' },
    },
    fix: { fn: 'heaterPosition', label_i18n: { cs: 'Posunout kamna', de: 'Ofen verschieben', en: 'Move heater' } },
    source: 'zadání MVP, pravidlo 2; odstupy z katalogu kamen',
  },
  {
    id: 'R03', level: 'error', title: { cs: 'Výška kabiny', de: 'Kabinenhöhe', en: 'Cabin height' },
    check: { kind: 'expr', assert: { op: 'gte', a: { fact: 'sauna.clearHeight_mm' }, b: { fact: 'heater.minCabinHeight_mm' } } },
    message_i18n: { cs: 'Světlá výška kabiny {sauna.clearHeight_mm} mm je menší než minimum kamen {heater.minCabinHeight_mm} mm.', de: 'Kabinenhöhe {sauna.clearHeight_mm} mm unter Ofenminimum {heater.minCabinHeight_mm} mm.', en: 'Cabin height {sauna.clearHeight_mm} mm below heater minimum {heater.minCabinHeight_mm} mm.' },
    fix: { fn: 'suitableHeater', label_i18n: { cs: 'Vybrat vhodná kamna', de: 'Passenden Ofen wählen', en: 'Pick a suitable heater' } },
    source: 'zadání MVP, pravidlo 3',
  },
  {
    id: 'R03b', level: 'warning', title: { cs: 'Horní lavice – strop', de: 'Oberbank – Decke', en: 'Top bench to ceiling' },
    when: { op: 'ne', a: { fact: 'sauna.topBenchToCeiling_mm' }, b: { value: null } },
    check: { kind: 'expr', assert: { op: 'between', a: { fact: 'sauna.topBenchToCeiling_mm' }, min: { limit: 'topBenchToCeiling_mm.min' }, max: { limit: 'topBenchToCeiling_mm.max' } } },
    message_i18n: { cs: 'Horní lavice – strop {sauna.topBenchToCeiling_mm} mm, doporučeno {limit.topBenchToCeiling_mm.min}–{limit.topBenchToCeiling_mm.max} mm.', de: 'Oberbank – Decke {sauna.topBenchToCeiling_mm} mm, empfohlen {limit.topBenchToCeiling_mm.min}–{limit.topBenchToCeiling_mm.max} mm.', en: 'Top bench to ceiling {sauna.topBenchToCeiling_mm} mm, recommended {limit.topBenchToCeiling_mm.min}–{limit.topBenchToCeiling_mm.max} mm.' },
    source: 'zadání MVP, pravidlo 3',
  },
  {
    id: 'R04', level: 'error', title: { cs: 'Dveře sauny', de: 'Saunatür', en: 'Sauna door' },
    check: { kind: 'fn', fn: 'saunaDoor' },
    message_i18n: { cs: 'Dveře sauny nevyhovují.', de: 'Saunatür ungültig.', en: 'Sauna door invalid.' },
    messages: {
      missing: { cs: 'Sauna nemá dveře.', de: 'Sauna hat keine Tür.', en: 'The sauna has no door.' },
      width: { cs: 'Dveře {opening}: světlá šířka {clearWidth_mm} mm < {min_mm} mm.', de: 'Tür {opening}: lichte Breite {clearWidth_mm} mm < {min_mm} mm.', en: 'Door {opening}: clear width {clearWidth_mm} mm < {min_mm} mm.' },
      swing: { cs: 'Dveře {opening} se musí otevírat ven ze sauny.', de: 'Tür {opening} muss nach außen öffnen.', en: 'Door {opening} must open out of the sauna.' },
      bench: { cs: 'Před dveřmi {opening} překáží lavice {bench}.', de: 'Bank {bench} blockiert Tür {opening}.', en: 'Bench {bench} blocks door {opening}.' },
      heater: { cs: 'Před dveřmi {opening} překáží kamna.', de: 'Ofen blockiert Tür {opening}.', en: 'Heater blocks door {opening}.' },
    },
    fix: { fn: 'doorPosition', label_i18n: { cs: 'Uvolnit průchod dveří', de: 'Türdurchgang freimachen', en: 'Clear the door passage' } },
    source: 'zadání MVP, pravidlo 4',
  },
  {
    id: 'R05', level: 'auto', title: { cs: 'Kouřovod kamen na dřevo', de: 'Rauchrohr Holzofen', en: 'Wood heater flue' },
    when: { op: 'eq', a: { fact: 'heater.fuel' }, b: { value: 'wood' } },
    action: { fn: 'chimney' },
    message_i18n: { cs: 'Přidána komínová sestava.', de: 'Kaminset hinzugefügt.', en: 'Chimney set added.' },
    source: 'zadání MVP, pravidlo 5',
  },
  {
    id: 'R05b', level: 'error', title: { cs: 'Odstupy kouřovodu', de: 'Abstände Rauchrohr', en: 'Flue clearances' },
    when: { op: 'eq', a: { fact: 'heater.fuel' }, b: { value: 'wood' } },
    check: { kind: 'fn', fn: 'flueClearance' },
    message_i18n: { cs: 'Kouřovod nevyhovuje.', de: 'Rauchrohr ungültig.', en: 'Flue invalid.' },
    messages: {
      wall: { cs: 'Kouřovod je {distance_mm} mm od hořlavé stěny, potřeba {required_mm} mm.', de: 'Rauchrohr {distance_mm} mm von brennbarer Wand, benötigt {required_mm} mm.', en: 'Flue is {distance_mm} mm from a combustible wall, {required_mm} mm required.' },
      edge: { cs: 'Kouřovod je {distance_mm} mm od okraje střechy (okap), potřeba {required_mm} mm.', de: 'Rauchrohr {distance_mm} mm vom Dachrand, benötigt {required_mm} mm.', en: 'Flue is {distance_mm} mm from the roof edge, {required_mm} mm required.' },
      slot: { cs: 'Kouřovod nevychází do střešního slotu.', de: 'Rauchrohr liegt in keinem Dachslot.', en: 'Flue is not inside a roof slot.' },
    },
    fix: { fn: 'heaterPosition', label_i18n: { cs: 'Posunout kamna', de: 'Ofen verschieben', en: 'Move heater' } },
    source: 'zadání MVP, pravidlo 5',
  },
  {
    id: 'R06', level: 'auto', title: { cs: 'Větrání', de: 'Lüftung', en: 'Ventilation' },
    action: { fn: 'ventilation' },
    message_i18n: { cs: 'Větrání doplněno.', de: 'Lüftung ergänzt.', en: 'Ventilation added.' },
    source: 'zadání MVP, pravidlo 6',
  },
  {
    id: 'R07', level: 'auto', title: { cs: 'Výztuha širokého otvoru', de: 'Verstärkung breiter Öffnung', en: 'Wide opening reinforcement' },
    action: { fn: 'openingReinforcement' },
    message_i18n: { cs: 'Doplněn výztužný rám.', de: 'Verstärkungsrahmen ergänzt.', en: 'Reinforcement frame added.' },
    source: 'zadání MVP, pravidlo 7',
  },
  {
    id: 'R08', level: 'error', title: { cs: 'Minimální délka zóny', de: 'Mindestlänge der Zone', en: 'Minimum zone length' },
    check: { kind: 'fn', fn: 'zoneLengths' },
    message_i18n: { cs: 'Zóna {zone} ({type}) má délku {length_mm} mm, minimum {min_mm} mm.', de: 'Zone {zone} ({type}) ist {length_mm} mm lang, Minimum {min_mm} mm.', en: 'Zone {zone} ({type}) is {length_mm} mm long, minimum {min_mm} mm.' },
    fix: { fn: 'none', label_i18n: { cs: 'Posunout příčku', de: 'Trennwand verschieben', en: 'Move partition' } },
    source: 'zadání MVP, pravidlo 8',
  },
  {
    id: 'R09', level: 'auto', title: { cs: 'Podpěry lavic', de: 'Bankstützen', en: 'Bench supports' },
    action: { fn: 'benchSupports' },
    message_i18n: { cs: 'Doplněny podpěry lavice.', de: 'Bankstützen ergänzt.', en: 'Bench supports added.' },
    source: 'zadání MVP, pravidlo 9',
  },
  {
    id: 'R10', level: 'auto', title: { cs: 'Elektro přípojka kamen', de: 'Elektroanschluss Ofen', en: 'Heater electrical supply' },
    when: { op: 'eq', a: { fact: 'heater.fuel' }, b: { value: 'electric' } },
    action: { fn: 'electrical' },
    message_i18n: { cs: 'Vypočtena přípojka.', de: 'Anschluss berechnet.', en: 'Supply computed.' },
    source: 'zadání MVP, pravidlo 10',
  },

  // ------------------------------------------------------- mass / transport
  {
    id: 'M01', level: 'warning', title: { cs: 'Reakce v závěsných bodech', de: 'Reaktionen an Anschlagpunkten', en: 'Lifting point reactions' },
    check: { kind: 'fn', fn: 'liftSpread' },
    message_i18n: { cs: 'Reakce v závěsných bodech se liší o {spread_pct} % (limit {limit_pct} %).', de: 'Reaktionen an Anschlagpunkten weichen um {spread_pct} % ab (Grenze {limit_pct} %).', en: 'Lifting reactions differ by {spread_pct} % (limit {limit_pct} %).' },
    source: 'zadání MVP',
  },
  {
    id: 'T01', level: 'warning', title: { cs: 'Nadrozměrná přeprava', de: 'Übermaßtransport', en: 'Oversize transport' },
    check: { kind: 'fn', fn: 'transportOversize' },
    message_i18n: { cs: 'Nadrozměrná přeprava (šířka {width_mm} mm, výška na vozidle {height_mm} mm).', de: 'Übermaßtransport (Breite {width_mm} mm, Höhe auf Fahrzeug {height_mm} mm).', en: 'Oversize transport (width {width_mm} mm, height on vehicle {height_mm} mm).' },
    source: 'zadání MVP',
  },
];
