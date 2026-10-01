# REF-2 – custom 2,3 × 6 m, 2 zóny, terasa

Konfigurace `ref-2`, katalog `demo-1`. Generováno z `@sauna/core` (`pnpm --filter @sauna/core report`). Jednotky: mm, kg, kN, Kč bez DPH. Souřadnice: počátek levý přední dolní roh, X = délka, Y = šířka, Z = výška.

## Geometrie

|  | min → max (rozměry) |
|---|---|
| Obálka (plášť) | [0; 0; 0] → [6 000; 2 300; 2 700] (6 000 × 2 300 × 2 700) |
| Nosná konstrukce | [47; 47; 1] → [5 953; 2 253; 2 592] (5 906 × 2 206 × 2 591) |
| Vnitřní světlý prostor | [218; 218; 151] → [5 782; 2 082; 2 421] (5 564 × 1 864 × 2 270) |
| Místnost z-sauna (sauna) | [218; 218; 151] → [3 525; 2 082; 2 421] (3 307 × 1 864 × 2 270) |
| Místnost z-changing (changing) | [3 676; 218; 151] → [5 782; 2 082; 2 421] (2 107 × 1 864 × 2 270) |

| Skladba | vně | konstrukce | uvnitř | celkem |
|---|---|---|---|---|
| wall (LAY-C-WALL) | 47 | 80 | 91 | 218 |
| roof (LAY-C-ROOF) | 108 | 80 | 91 | 279 |
| floor (LAY-C-FLOOR) | 1 | 100 | 50 | 151 |
| partition (LAY-PARTITION) | 0 | 0 | 151 | 151 |

Příčky: P1 osa x = 3 600, tl. 151

## Ocel

| Poz. | Sestava | Profil / popis | Délka | ks | kg/m | kg celkem | Povrch m² |
|---|---|---|---|---|---|---|---|
| S01 | frame | RHS 100×100×4 | 5 906 | 2 | 11,7 | 138,2 | 4,52 |
| S02 | frame | RHS 100×100×4 | 2 006 | 2 | 11,7 | 46,94 | 1,54 |
| S03 | frame | RHS 60×40×3 | 2 400 | 2 | 4,25 | 20,4 | 0,92 |
| S04 | frame | RHS 60×40×3 | 2 046 | 9 | 4,25 | 78,26 | 3,54 |
| S05 | frame | RHS 60×40×3 | 2 006 | 9 | 4,25 | 76,73 | 3,47 |
| S06 | frame | RHS 60×40×3 | 1 200 | 2 | 4,25 | 10,2 | 0,46 |
| S07 | frame | RHS 80×80×3 | 5 906 | 2 | 7,07 | 83,51 | 3,65 |
| S08 | frame | RHS 80×80×3 | 2 411 | 11 | 7,07 | 187,5 | 8,19 |
| S09 | frame | RHS 80×80×3 | 2 046 | 2 | 7,07 | 28,93 | 1,26 |

Σ ocel: 670,67 kg

## Dřevo a plášť

| Poz. | Sestava | SKU | Popis | Množství | MJ | Prořez | kg | Přeprava |
|---|---|---|---|---|---|---|---|---|
| D01 | shell | BOTTOM-SHEET | Spodní krycí plech 0,5 mm | 13,03 | m2 | 8 % | 59,93 |  |
| D02 | shell | CLAD-YAKISUGI | Yakisugi (opálené dřevo) 21×125 | 40,61 | m2 | 12 % | 385,8 |  |
| D03 | shell | MEM-DIFF | Difuzní fólie | 54,41 | m2 | 10 % | 8,16 |  |
| D04 | shell | ROOF-TRAPEZ | Střešní trapéz T35 0,6 mm | 13,8 | m2 | 8 % | 80,04 |  |
| D05 | shell | SHEATH-OSB-22 | OSB/3 22 mm | 13,8 | m2 | 8 % | 187,68 |  |
| D06 | shell | TIM-BATTEN-25x50 | Lať smrk 25×50 | 67,68 | m | 10 % | 38,07 |  |
| D07 | shell | TIM-BATTEN-50x50 | Lať smrk 50×50 | 23 | m | 10 % | 25,88 |  |
| D08 | insulation | INS-MW-100 | Minerální vata 100 mm | 15,71 | m2 | 5 % | 54,99 |  |
| D09 | insulation | INS-MW-50 | Minerální vata 50 mm | 35,67 | m2 | 5 % | 62,43 |  |
| D10 | insulation | INS-MW-80 | Minerální vata 80 mm | 50,86 | m2 | 5 % | 142,39 |  |
| D11 | interior | BENCH-BOARD-ABACHI-28 | Lavicové prkno abachi 28×90 | 2,7 | m2 | 10 % | 25,95 |  |
| D12 | interior | FLOOR-THERMO-28 | Podlaha thermowood 28 mm | 10,09 | m2 | 10 % | 119,06 |  |
| D13 | interior | INT-THERMO-ASPEN-15 | Thermo-osika SHP 15×90 | 44,72 | m2 | 10 % | 268,32 |  |
| D14 | interior | SHEATH-OSB-22 | OSB/3 22 mm | 10,09 | m2 | 8 % | 137,22 |  |
| D15 | interior | TIM-BATTEN-25x50 | Lať smrk 25×50 | 69,7 | m | 10 % | 39,21 |  |
| D16 | interior | TIM-BATTEN-50x50 | Lať smrk 50×50 | 64,86 | m | 10 % | 72,97 |  |
| D17 | interior | TIM-KVH-45x95 | KVH 45×95 | 4,84 | m | 8 % | 9,3 |  |
| D18 | interior | TIM-SUPPORT-45x70 | Podpěra lavice osika 45×70 | 11,1 | m | 10 % | 15,73 |  |
| D19 | interior | VB-ALU | Parozábrana Al (saunová) | 41,82 | m2 | 10 % | 8,36 |  |

## Nakupované díly

| Poz. | Sestava | SKU | Popis | Množství | MJ | Prořez | kg | Přeprava |
|---|---|---|---|---|---|---|---|---|
| N01 | frame | LUG-20 | Závěsné oko 2 t | 4 | ks | 0 % | 10 |  |
| N02 | shell | VENT-GRILLE-100 | Větrací mřížka – odvod | 1 | ks | 0 % | 0,3 |  |
| N03 | shell | VENT-GRILLE-100 | Větrací mřížka – přívod | 1 | ks | 0 % | 0,3 |  |
| N04 | glazing | DOOR-GLASS-700x1900 | Celoskleněné dveře 700×1 900 | 2 | ks | 0 % | 90 |  |
| N05 | glazing | WIN-PANO-2400x1200 | Panoramatické okno 2 400×1 200 | 1 | ks | 0 % | 110 |  |
| N06 | heater | HEATER-EL-B | Elektrická kamna 18 kW (placeholder) vč. kamenů 45 kg | 1 | ks | 0 % | 80 |  |
| N07 | electrical | LED-STRIP-SAUNA | LED pásek saunový 2 m | 1 | ks | 0 % | 0,5 |  |
| N08 | terrace | RAILING-STD | Zábradlí ocel + dřevo – hrana N | 1,8 | m | 0 % | 21,6 | demont. |
| N09 | terrace | RAILING-STD | Zábradlí ocel + dřevo – hrana S | 1,8 | m | 0 % | 21,6 | demont. |
| N10 | terrace | STAIRS-3 | Schody 3 stupně | 1 | ks | 0 % | 60 | demont. |
| N11 | terrace | TERRACE-STD | Terasa thermowood na ocelovém roštu | 4,14 | m2 | 0 % | 186,3 | demont. |
| N12 | foundation | SCREW-76 | Zemní vrut Ø76×1 600 | 8 | ks | 0 % | 72 | demont. |

## Hmotnost a těžiště

| Sestava | kg | Těžiště [x; y; z] |
|---|---|---|
| frame | 680,7 | [3 069; 1 061; 1 192] |
| shell | 786,2 | [2 992; 1 199; 1 736] |
| insulation | 259,8 | [3 012; 1 212; 1 336] |
| interior | 696,1 | [2 899; 1 200; 990] |
| glazing | 200 | [3 130; 430; 1 184] |
| terrace | 289,5 | [7 180; 1 150; 162] |
| heater | 80 | [2 600; 1 832; 526] |
| electrical | 0,5 | [238; 1 150; 1 651] |

| Stav | kg | Těžiště [x; y; z] |
|---|---|---|
| Prázdná (osazená, bez základů) | 2 992,8 | [3 393; 1 130; 1 183] |
| Přepravní (bez demontovaných dílů) | 2 703,3 | [2 988; 1 128; 1 292] |
| Základy (samostatně) | 72 |  |

## Reakce v závěsných bodech

Tuhé těleso na 4 stejně tuhých podporách (D-010). G = 26,52 kN, rozptyl (Rmax − Rmin)/Rmean = 5 %.

| Bod | Poloha [x; y; z] | R [kN] |
|---|---|---|
| A | [87; 87; 2 592] | 6,797 |
| B | [5 913; 87; 2 592] | 6,74 |
| C | [5 913; 2 213; 2 592] | 6,462 |
| D | [87; 2 213; 2 592] | 6,519 |

## Podpěry (screws)

Vlastní tíha modulu bez přídavků na vlastních podporách: 26,52 kN, těžiště [2 988; 1 128; 1 292]. Bez užitného zatížení a sněhu.

| Bod | Poloha [x; y] | R [kN] |
|---|---|---|
| P1 | [97; 97] | 3,411 |
| P2 | [97; 2 203] | 3,27 |
| P3 | [2 032; 97] | 3,394 |
| P4 | [2 032; 2 203] | 3,253 |
| P5 | [3 968; 97] | 3,376 |
| P6 | [3 968; 2 203] | 3,236 |
| P7 | [5 903; 97] | 3,359 |
| P8 | [5 903; 2 203] | 3,219 |

## Doprava

|  |  |
|---|---|
| Rozměry (D × Š × V) | 6 000 × 2 300 × 2 700 |
| Vozidlo | truck_hiab (ložná výška 1 250) |
| Výška na vozidle | 3 950 |
| Nadrozměr | ne |
| Přepravní hmotnost | 2 703,3 kg |
| Demontované díly | RAILING-STD, STAIRS-3, TERRACE-STD |

## Sauna

|  |  |
|---|---|
| Vnitřní objem V | 13,991 m³ |
| Plocha skla | 3,7 m² |
| Nezaizolované plochy | 0 m² |
| Ekvivalentní objem | 18,431 m³ |
| Vhodná kamna | HEATER-EL-B, HEATER-WOOD-A, HEATER-WOOD-B |
| Světlá výška kabiny | 2 270 |
| Horní lavice / strop | 1 100 / 1 170 |
| Elektro | 18 kW, 400 V, jistič 32 A, CYKY-J 5×6 |

## Průstupy

| Id | Druh | Plocha | Poloha [x; y; z] | Rozměr |
|---|---|---|---|---|
| vent-supply | vent_supply | N | [2 600; 2 082; 451] | Ø100 |
| vent-exhaust | vent_exhaust | S | [518; 218; 2 121] | Ø100 |

## Automatické doplňky a varování

- **R06** (auto): Větrání: přívod na stěně N u kamen, odvod diagonálně na stěně S pod stropem.
- **R07** (auto): Otvor pano-1 (4 slotů > 2): doplněn výztužný rám.
- **R09** (auto): Lavice main-L2: rozpětí 1 864 mm > 1 500 mm, doplněno 1 podpěr.
- **R09** (auto): Lavice main-L1: rozpětí 1 864 mm > 1 500 mm, doplněno 1 podpěr.
- **R09** (auto): Lavice main-L0: rozpětí 1 864 mm > 1 500 mm, doplněno 1 podpěr.
- **R10** (auto): Přípojka kamen: 18 kW / 400 V, jistič 32 A, kabel CYKY-J 5×6 (orientačně, ověří elektroprojektant).

## Cena

| Kategorie | Náklad | Cena |
|---|---|---|
| steel | 33 005 | 41 257 |
| timber | 169 728 | 220 646 |
| purchased | 162 568 | 195 082 |
| labour | 113 037 | 152 600 |
| transport | 11 750 | 12 925 |
| crane | 0 | 0 |
| total | 490 088 | 622 509 |

Zobrazení: 560 000 – 685 000 Kč

