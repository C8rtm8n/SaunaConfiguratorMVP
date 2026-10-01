# REF-3 – ISO 20′ HC, prosklené čelo

Konfigurace `ref-3`, katalog `demo-1`. Generováno z `@sauna/core` (`pnpm --filter @sauna/core report`). Jednotky: mm, kg, kN, Kč bez DPH. Souřadnice: počátek levý přední dolní roh, X = délka, Y = šířka, Z = výška.

## Geometrie

|  | min → max (rozměry) |
|---|---|
| Obálka (plášť) | [-52; -52; 0] → [6 110; 2 490; 2 982] (6 162 × 2 542 × 2 982) |
| Nosná konstrukce | [0; 0; 0] → [6 058; 2 438; 2 896] (6 058 × 2 438 × 2 896) |
| Vnitřní světlý prostor | [134; 134; 258] → [5 924; 2 304; 2 765] (5 790 × 2 170 × 2 507) |
| Místnost z-changing (changing) | [134; 134; 258] → [1 725; 2 304; 2 765] (1 591 × 2 170 × 2 507) |
| Místnost z-sauna (sauna) | [1 876; 134; 258] → [5 924; 2 304; 2 765] (4 049 × 2 170 × 2 507) |

| Skladba | vně | konstrukce | uvnitř | celkem |
|---|---|---|---|---|
| wall (LAY-I-WALL) | 52 | 43 | 91 | 186 |
| roof (LAY-I-ROOF) | 86 | 40 | 91 | 217 |
| floor (LAY-I-FLOOR) | 0 | 158 | 100 | 258 |
| partition (LAY-PARTITION) | 0 | 0 | 151 | 151 |

Příčky: P1 osa x = 1 800, tl. 151

## Ocel

| Poz. | Sestava | Profil / popis | Délka | ks | kg/m | kg celkem | Povrch m² |
|---|---|---|---|---|---|---|---|
| S01 | frame | Výřez stěny kontejneru 2100×2300 |  | 1 |  | -86,94 |  |
| S02 | frame | Výřez stěny kontejneru 700×1900 |  | 1 |  | -23,94 |  |
| S03 | frame | Demontáž dveří kontejneru |  | 1 |  | -280 |  |
| S04 | frame | L 50×50×5 | 2 300 | 2 | 3,77 | 17,34 | 0,89 |
| S05 | frame | L 50×50×5 | 2 100 | 1 | 3,77 | 7,92 | 0,41 |
| S06 | frame | L 50×50×5 | 1 900 | 2 | 3,77 | 14,33 | 0,74 |
| S07 | frame | L 50×50×5 | 700 | 1 | 3,77 | 2,64 | 0,14 |
| S08 | foundation | UPN 120 | 2 738 | 4 | 13,4 | 146,76 | 4,75 |

Σ ocel: -201,9 kg

## Dřevo a plášť

| Poz. | Sestava | SKU | Popis | Množství | MJ | Prořez | kg | Přeprava |
|---|---|---|---|---|---|---|---|---|
| D01 | shell | CLAD-THERMO-26x92 | Thermowood borovice 26×92 rhombus | 45,75 | m2 | 12 % | 457,51 |  |
| D02 | shell | MEM-DIFF | Difuzní fólie | 61,41 | m2 | 10 % | 9,21 |  |
| D03 | shell | ROOF-TRAPEZ | Střešní trapéz T35 0,6 mm | 15,66 | m2 | 8 % | 90,85 |  |
| D04 | shell | TIM-BATTEN-25x50 | Lať smrk 25×50 | 76,25 | m | 10 % | 42,89 |  |
| D05 | shell | TIM-BATTEN-50x50 | Lať smrk 50×50 | 26,11 | m | 10 % | 29,37 |  |
| D06 | insulation | INS-MW-100 | Minerální vata 100 mm | 3,8 | m2 | 5 % | 13,31 |  |
| D07 | insulation | INS-MW-50 | Minerální vata 50 mm | 52,68 | m2 | 5 % | 92,19 |  |
| D08 | interior | BENCH-BOARD-ABACHI-28 | Lavicové prkno abachi 28×90 | 3,6 | m2 | 10 % | 34,51 |  |
| D09 | interior | FLOOR-THERMO-28 | Podlaha thermowood 28 mm | 12,24 | m2 | 10 % | 144,39 |  |
| D10 | interior | INT-ASPEN-15 | Osika SHP 15×90 | 53,45 | m2 | 10 % | 363,47 |  |
| D11 | interior | SHEATH-OSB-22 | OSB/3 22 mm | 12,24 | m2 | 8 % | 166,42 |  |
| D12 | interior | TIM-BATTEN-25x50 | Lať smrk 25×50 | 82,24 | m | 10 % | 46,26 |  |
| D13 | interior | TIM-BATTEN-50x50 | Lať smrk 50×50 | 95,78 | m | 10 % | 107,75 |  |
| D14 | interior | TIM-KVH-45x95 | KVH 45×95 | 6,85 | m | 8 % | 13,18 |  |
| D15 | interior | TIM-SUPPORT-45x70 | Podpěra lavice osika 45×70 | 11,6 | m | 10 % | 16,44 |  |
| D16 | interior | VB-ALU | Parozábrana Al (saunová) | 49,34 | m2 | 10 % | 9,87 |  |

## Nakupované díly

| Poz. | Sestava | SKU | Popis | Množství | MJ | Prořez | kg | Přeprava |
|---|---|---|---|---|---|---|---|---|
| N01 | frame | CONT-20HC | ISO kontejner 20′ HC (použitý, cargo-worthy) | 1 | ks | 0 % | 2 250 |  |
| N02 | shell | VENT-GRILLE-100 | Větrací mřížka – odvod | 1 | ks | 0 % | 0,3 |  |
| N03 | shell | VENT-GRILLE-100 | Větrací mřížka – přívod | 1 | ks | 0 % | 0,3 |  |
| N04 | glazing | DOOR-GLASS-700x1900 | Celoskleněné dveře 700×1 900 | 2 | ks | 0 % | 90 |  |
| N05 | glazing | GLASS-FRONT-ISO | Prosklené čelo ISO | 1 | ks | 0 % | 220 |  |
| N06 | heater | HEATER-EL-B | Elektrická kamna 18 kW (placeholder) vč. kamenů 45 kg | 1 | ks | 0 % | 80 |  |
| N07 | electrical | LED-STRIP-SAUNA | LED pásek saunový 2 m | 1 | ks | 0 % | 0,5 |  |
| N08 | foundation | PAD-CONCRETE | Betonová patka 400×400 | 8 | ks | 0 % | 360 | demont. |

## Hmotnost a těžiště

| Sestava | kg | Těžiště [x; y; z] |
|---|---|---|
| frame | 1 901,3 | [2 492; 1 223; 1 104] |
| shell | 630,4 | [2 812; 1 248; 1 789] |
| interior | 902,3 | [2 895; 1 275; 1 198] |
| insulation | 105,5 | [2 721; 1 255; 1 536] |
| glazing | 310 | [4 724; 1 002; 1 350] |
| heater | 80 | [3 200; 384; 633] |
| electrical | 0,5 | [4 212; 2 004; 1 300] |

| Stav | kg | Těžiště [x; y; z] |
|---|---|---|
| Prázdná (osazená, bez základů) | 3 930,1 | [2 833; 1 206; 1 257] |
| Přepravní (bez demontovaných dílů) | 3 930,1 | [2 833; 1 206; 1 257] |
| Základy (samostatně) | 506,8 |  |

## Reakce v závěsných bodech

Tuhé těleso na 4 stejně tuhých podporách (D-010). G = 38,55 kN, rozptyl (Rmax − Rmin)/Rmean = 15,7 %.

| Bod | Poloha [x; y; z] | R [kN] |
|---|---|---|
| A | [75; 75; 2 896] | 10,393 |
| B | [5 983; 75; 2 896] | 9,111 |
| C | [5 983; 2 363; 2 896] | 8,884 |
| D | [75; 2 363; 2 896] | 10,166 |

## Podpěry (beams)

Vlastní tíha modulu bez přídavků na vlastních podporách: 38,55 kN, těžiště [2 833; 1 206; 1 257]. Bez užitného zatížení a sněhu.

| Bod | Poloha [x; y] | R [kN] |
|---|---|---|
| P1 | [75; 75] | 5,453 |
| P2 | [75; 2 363] | 5,339 |
| P3 | [2 044; 75] | 5,068 |
| P4 | [2 044; 2 363] | 4,955 |
| P5 | [4 014; 75] | 4,684 |
| P6 | [4 014; 2 363] | 4,57 |
| P7 | [5 983; 75] | 4,299 |
| P8 | [5 983; 2 363] | 4,186 |

## Doprava

|  |  |
|---|---|
| Rozměry (D × Š × V) | 6 162 × 2 542 × 2 982 |
| Vozidlo | truck_hiab (ložná výška 1 250) |
| Výška na vozidle | 4 232 |
| Nadrozměr | ano (height) |
| Přepravní hmotnost | 3 930,1 kg |
| Demontované díly | – |

## Sauna

|  |  |
|---|---|
| Vnitřní objem V | 22,025 m³ |
| Plocha skla | 5,4 m² |
| Nezaizolované plochy | 0 m² |
| Ekvivalentní objem | 28,505 m³ |
| Vhodná kamna | HEATER-EL-B |
| Světlá výška kabiny | 2 507 |
| Horní lavice / strop | 1 100 / 1 407 |
| Elektro | 18 kW, 400 V, jistič 32 A, CYKY-J 5×6 |

## Průstupy

| Id | Druh | Plocha | Poloha [x; y; z] | Rozměr |
|---|---|---|---|---|
| vent-supply | vent_supply | S | [3 200; 134; 558] | Ø100 |
| vent-exhaust | vent_exhaust | N | [5 624; 2 304; 2 465] | Ø100 |

## Automatické doplňky a varování

- **R06** (auto): Větrání: přívod na stěně S u kamen, odvod diagonálně na stěně N pod stropem.
- **R07** (auto): Otvor front (4 slotů > 1): doplněn výztužný rám.
- **R07** (auto): Otvor door-1 (2 slotů > 1): doplněn výztužný rám.
- **R09** (auto): Lavice main-L1: rozpětí 3 424 mm > 1 500 mm, doplněno 2 podpěr.
- **R09** (auto): Lavice main-L0: rozpětí 3 424 mm > 1 500 mm, doplněno 2 podpěr.
- **R10** (auto): Přípojka kamen: 18 kW / 400 V, jistič 32 A, kabel CYKY-J 5×6 (orientačně, ověří elektroprojektant).
- **R03b** (warning): Horní lavice – strop 1 407 mm, doporučeno 1 100–1 200 mm.
- **T01** (warning): Nadrozměrná přeprava (šířka 2 542 mm, výška na vozidle 4 232 mm).

## Cena

| Kategorie | Náklad | Cena |
|---|---|---|
| steel | 8 982 | 11 227 |
| timber | 124 926 | 162 403 |
| purchased | 249 100 | 298 920 |
| labour | 88 770 | 119 840 |
| transport | 23 750 | 26 125 |
| crane | 0 | 0 |
| total | 495 528 | 618 515 |

Zobrazení: 557 000 – 680 000 Kč

