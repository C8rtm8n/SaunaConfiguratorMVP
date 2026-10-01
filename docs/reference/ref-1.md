# REF-1 – custom 2,3 × 4,2 m, kamna na dřevo

Konfigurace `ref-1`, katalog `demo-1`. Generováno z `@sauna/core` (`pnpm --filter @sauna/core report`). Jednotky: mm, kg, kN, Kč bez DPH. Souřadnice: počátek levý přední dolní roh, X = délka, Y = šířka, Z = výška.

## Geometrie

|  | min → max (rozměry) |
|---|---|
| Obálka (plášť) | [0; 0; 0] → [4 200; 2 300; 2 700] (4 200 × 2 300 × 2 700) |
| Nosná konstrukce | [52; 52; 1] → [4 148; 2 248; 2 592] (4 096 × 2 196 × 2 591) |
| Vnitřní světlý prostor | [223; 223; 151] → [3 977; 2 077; 2 421] (3 754 × 1 854 × 2 270) |
| Místnost z-sauna (sauna) | [223; 223; 151] → [3 977; 2 077; 2 421] (3 754 × 1 854 × 2 270) |

| Skladba | vně | konstrukce | uvnitř | celkem |
|---|---|---|---|---|
| wall (LAY-C-WALL) | 52 | 80 | 91 | 223 |
| roof (LAY-C-ROOF) | 108 | 80 | 91 | 279 |
| floor (LAY-C-FLOOR) | 1 | 100 | 50 | 151 |
| partition (LAY-PARTITION) | 0 | 0 | 151 | 151 |

Příčky: –

## Ocel

| Poz. | Sestava | Profil / popis | Délka | ks | kg/m | kg celkem | Povrch m² |
|---|---|---|---|---|---|---|---|
| S01 | frame | RHS 100×100×4 | 4 096 | 2 | 11,7 | 95,85 | 3,14 |
| S02 | frame | RHS 100×100×4 | 1 996 | 2 | 11,7 | 46,71 | 1,53 |
| S03 | frame | RHS 60×40×3 | 2 036 | 6 | 4,25 | 51,92 | 2,35 |
| S04 | frame | RHS 60×40×3 | 1 996 | 6 | 4,25 | 50,9 | 2,3 |
| S05 | frame | RHS 80×80×3 | 4 096 | 2 | 7,07 | 57,92 | 2,53 |
| S06 | frame | RHS 80×80×3 | 2 411 | 9 | 7,07 | 153,41 | 6,7 |
| S07 | frame | RHS 80×80×3 | 2 036 | 2 | 7,07 | 28,79 | 1,26 |

Σ ocel: 485,49 kg

## Dřevo a plášť

| Poz. | Sestava | SKU | Popis | Množství | MJ | Prořez | kg | Přeprava |
|---|---|---|---|---|---|---|---|---|
| D01 | shell | BOTTOM-SHEET | Spodní krycí plech 0,5 mm | 8,99 | m2 | 8 % | 41,38 |  |
| D02 | shell | CLAD-THERMO-26x92 | Thermowood borovice 26×92 rhombus | 33,23 | m2 | 12 % | 332,3 |  |
| D03 | shell | MEM-DIFF | Difuzní fólie | 42,89 | m2 | 10 % | 6,43 |  |
| D04 | shell | ROOF-TRAPEZ | Střešní trapéz T35 0,6 mm | 9,66 | m2 | 8 % | 56,03 |  |
| D05 | shell | SHEATH-OSB-22 | OSB/3 22 mm | 9,66 | m2 | 8 % | 131,38 |  |
| D06 | shell | TIM-BATTEN-25x50 | Lať smrk 25×50 | 55,38 | m | 10 % | 31,15 |  |
| D07 | shell | TIM-BATTEN-50x50 | Lať smrk 50×50 | 16,1 | m | 10 % | 18,11 |  |
| D08 | insulation | INS-MW-100 | Minerální vata 100 mm | 8,99 | m2 | 5 % | 31,48 |  |
| D09 | insulation | INS-MW-50 | Minerální vata 50 mm | 28 | m2 | 5 % | 49,01 |  |
| D10 | insulation | INS-MW-80 | Minerální vata 80 mm | 39,73 | m2 | 5 % | 111,24 |  |
| D11 | interior | BENCH-BOARD-ABACHI-28 | Lavicové prkno abachi 28×90 | 3,21 | m2 | 10 % | 30,78 |  |
| D12 | interior | FLOOR-THERMO-28 | Podlaha thermowood 28 mm | 6,96 | m2 | 10 % | 82,13 |  |
| D13 | interior | INT-ASPEN-15 | Osika SHP 15×90 | 30,55 | m2 | 10 % | 207,74 |  |
| D14 | interior | SHEATH-OSB-22 | OSB/3 22 mm | 6,96 | m2 | 8 % | 94,65 |  |
| D15 | interior | TIM-BATTEN-25x50 | Lať smrk 25×50 | 50,92 | m | 10 % | 28,64 |  |
| D16 | interior | TIM-BATTEN-50x50 | Lať smrk 50×50 | 50,92 | m | 10 % | 57,28 |  |
| D17 | interior | TIM-SUPPORT-45x70 | Podpěra lavice osika 45×70 | 14,5 | m | 10 % | 20,55 |  |
| D18 | interior | VB-ALU | Parozábrana Al (saunová) | 30,55 | m2 | 10 % | 6,11 |  |

## Nakupované díly

| Poz. | Sestava | SKU | Popis | Množství | MJ | Prořez | kg | Přeprava |
|---|---|---|---|---|---|---|---|---|
| N01 | frame | LUG-20 | Závěsné oko 2 t | 4 | ks | 0 % | 10 |  |
| N02 | shell | VENT-GRILLE-100 | Větrací mřížka – odvod | 1 | ks | 0 % | 0,3 |  |
| N03 | shell | VENT-GRILLE-100 | Větrací mřížka – přívod | 1 | ks | 0 % | 0,3 |  |
| N04 | glazing | DOOR-GLASS-700x1900 | Celoskleněné dveře 700×1 900 | 1 | ks | 0 % | 45 |  |
| N05 | glazing | WIN-900x600 | Okno 900×600 | 1 | ks | 0 % | 32 |  |
| N06 | heater | HEATER-WOOD-A | Kamna na dřevo 16 kW (placeholder) vč. kamenů 60 kg | 1 | ks | 0 % | 130 |  |
| N07 | chimney | CHIMNEY-SET-115 | Komínová sestava Ø115 izolovaná (vč. průchodky střechou) | 1 | ks | 0 % | 35 | demont. |
| N08 | electrical | LED-STRIP-SAUNA | LED pásek saunový 2 m | 2 | ks | 0 % | 1 |  |
| N09 | foundation | PAD-CONCRETE | Betonová patka 400×400 | 6 | ks | 0 % | 270 | demont. |

## Hmotnost a těžiště

| Sestava | kg | Těžiště [x; y; z] |
|---|---|---|
| frame | 495,5 | [2 259; 1 134; 1 194] |
| shell | 617,4 | [2 073; 1 174; 1 693] |
| insulation | 191,7 | [2 066; 1 178; 1 328] |
| interior | 527,9 | [2 162; 1 186; 1 012] |
| glazing | 77 | [3 110; 656; 1 246] |
| heater | 130 | [783; 1 150; 531] |
| electrical | 1 | [3 677; 1 150; 1 193] |
| chimney | 35 | [783; 1 150; 2 306] |

| Stav | kg | Těžiště [x; y; z] |
|---|---|---|
| Prázdná (osazená, bez základů) | 2 075,5 | [2 076; 1 147; 1 288] |
| Přepravní (bez demontovaných dílů) | 2 040,5 | [2 098; 1 147; 1 270] |
| Základy (samostatně) | 270 |  |

## Reakce v závěsných bodech

Tuhé těleso na 4 stejně tuhých podporách (D-010). G = 20,02 kN, rozptyl (Rmax − Rmin)/Rmean = 0,8 %.

| Bod | Poloha [x; y; z] | R [kN] |
|---|---|---|
| A | [92; 92; 2 592] | 5,025 |
| B | [4 108; 92; 2 592] | 5,015 |
| C | [4 108; 2 208; 2 592] | 4,984 |
| D | [92; 2 208; 2 592] | 4,994 |

## Podpěry (pads)

Vlastní tíha modulu bez přídavků na vlastních podporách: 20,36 kN, těžiště [2 076; 1 147; 1 288]. Bez užitného zatížení a sněhu.

| Bod | Poloha [x; y] | R [kN] |
|---|---|---|
| P1 | [102; 102] | 3,465 |
| P2 | [102; 2 198] | 3,444 |
| P3 | [2 100; 102] | 3,404 |
| P4 | [2 100; 2 198] | 3,383 |
| P5 | [4 098; 102] | 3,343 |
| P6 | [4 098; 2 198] | 3,322 |

## Doprava

|  |  |
|---|---|
| Rozměry (D × Š × V) | 4 200 × 2 300 × 2 700 |
| Vozidlo | truck_hiab (ložná výška 1 250) |
| Výška na vozidle | 3 950 |
| Nadrozměr | ne |
| Přepravní hmotnost | 2 040,5 kg |
| Demontované díly | CHIMNEY-SET-115 |

## Sauna

|  |  |
|---|---|
| Vnitřní objem V | 15,799 m³ |
| Plocha skla | 1,55 m² |
| Nezaizolované plochy | 0 m² |
| Ekvivalentní objem | 17,659 m³ |
| Vhodná kamna | HEATER-EL-B, HEATER-WOOD-A, HEATER-WOOD-B |
| Světlá výška kabiny | 2 270 |
| Horní lavice / strop | 1 100 / 1 170 |
| Elektro | – |

## Průstupy

| Id | Druh | Plocha | Poloha [x; y; z] | Rozměr |
|---|---|---|---|---|
| flue | flue | roof | [783; 1 150; 2 700] | Ø115 |
| vent-supply | vent_supply | W | [223; 1 150; 451] | Ø100 |
| vent-exhaust | vent_exhaust | E | [3 977; 523; 2 121] | Ø100 |

## Automatické doplňky a varování

- **R05** (auto): Aktivován střešní slot 1 pro kouřovod Ø115 a přidána komínová sestava.
- **R06** (auto): Větrání: přívod na stěně W u kamen, odvod diagonálně na stěně E pod stropem.
- **R09** (auto): Lavice main-L1: rozpětí 1 854 mm > 1 500 mm, doplněno 1 podpěr.
- **R09** (auto): Lavice main-L0: rozpětí 1 854 mm > 1 500 mm, doplněno 1 podpěr.

## Cena

| Kategorie | Náklad | Cena |
|---|---|---|
| steel | 23 839 | 29 798 |
| timber | 93 288 | 121 274 |
| purchased | 73 400 | 88 080 |
| labour | 78 958 | 106 593 |
| transport | 11 750 | 12 925 |
| crane | 0 | 0 |
| total | 281 234 | 358 671 |

Zobrazení: 323 000 – 395 000 Kč

