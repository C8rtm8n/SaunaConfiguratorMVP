# M1 – Core: stav

Stav: **implementováno** (návrh schválen: Q1 varianta a, Q3 pevná výška 2 700 mm, zbytek podle návrhu, viz `DECISIONS.md`).

## Datový tok `evaluate(config, catalog)`

```
Config (záměr zákazníka)
  │ CatalogIndex (SKU → položka; neznámé SKU = výjimka)
  ▼
ModuleGeometry   geometry/module.ts   obálka / konstrukce / vnitřek ze skladeb, příčky, místnosti
SlotMap          geometry/slots.ts    stěny N/S/E/W, příčky P1…, střecha
Facts            shell + packs/sauna/index.ts
  ▼
auto pravidla    R05 komín, R06 větrání, R07 výztuhy, R09 podpěry lavic, R10 elektro → AutoAddition[]
  ▼
komponenty       frame.custom|frame.iso, shell.wall×4, roof, floor, partition, opening, reinforcement, attachment, foundation,
                 sauna.heater, benches, benchSupports, lighting, chimney, ventilation
  ▼              každý builder vrací { SceneNode, BomLine[], Penetration[] }
BOM (aggregate) → hmotnost/těžiště → reakce závěsů a podpěr → doprava → sauna report → cena
  ▼
check pravidla   S01 S02 S03 S10 R01 R02 R03 R03b R04 R05b R08 M01 T01 → Violation[] (+ JSON Patch fix)
  ▼
Evaluation       (schemaVersion 1)
```

## Struktura `packages/core/src`

| Složka | Obsah |
|---|---|
| `model/` | typy (Config, Catalog, SceneNode, BomLine, RuleDef, Evaluation, ProductLinePack) |
| `catalog/` | `createCatalogIndex` |
| `geometry/` | skladby a rozměry, sloty, umístění otvorů, pomocníci pro stěny a scénu |
| `shell/` | rám custom/ISO, stěny, střecha, podlaha, příčky, otvory + výztuhy, přídavky, osazení, kontroly S01–S03, M01, T01, auto R07 |
| `packs/sauna/` | layout sauny (kamna, obal, lavice, dveře, objem), buildery, kontroly a auto pravidla R01–R10 |
| `rules/` | výchozí pravidla (data), vyhodnocení podmínek, engine, JSON Patch |
| `calc/` | hmotnost, reakce, doprava, cena |
| `bom/` | tvorba řádků (ocel / plocha / řezivo / nakupované), agregace a pozice |
| `report/` | markdown report pro ruční ověření |
| `fixtures/` | demo katalog „Demo Sauny s.r.o.“, 3 referenční konfigurace |
| `__tests__/` | testy pravidel, výpočtů, snapshoty BOM |

## Testy (Vitest, 63)

- Každé pravidlo: R01–R10 včetně variant (stěna / lavice / sklo / dveře / strop u R02, chybějící / šířka / směr / lavice u R04…),
  S01–S03, S10, M01, T01. U pravidel s opravou test opravu aplikuje a ověří, že porušení zmizí.
- Snapshot BOM + souhrnu hmotností pro REF-1..3 (`__snapshots__/bomSnapshot.test.ts.snap`).
- Hmotnost oceli: BOM proti nezávislému součtu délek prutů ve 3D scéně × kg/m (±0,5 %). Katalogové kg/m RHS proti vzorci
  EN 10219-2 (±0,5 %).
- Těžiště: symetrická varianta všech 3 referencí má těžiště obalu v půdorysném středu (±0,1 mm). Součet reakcí = tíha,
  rovnováha momentů, uzavřený tvar pro 4 rohy.
- Determinismus (2× evaluate = shodný JSON), rozšíření katalogu o profil, okno a kamna bez změny kódu, hash scény se mění
  jen u dotčené komponenty, součet cen řádků = celková cena.

## Ruční ověření

`pnpm --filter @sauna/core report` vygeneruje `docs/reference/ref-{1,2,3}.md`: geometrie, skladby, ocel po pozicích (kg/m, délky, ks),
dřevo a plášť, nakupované díly, hmotnosti a těžiště po sestavách, reakce závěsů a podpěr, doprava, sauna, průstupy, auto doplňky,
varování a cena.

## K ověření (placeholdery v demo katalogu)

1. Parametry kamen (výkon, objemy, odstupy, hmotnosti, min. výška kabiny, vývod kouřovodu) – všechny jsou zástupné.
2. Skladby stěn, střechy, podlahy a příčky (D-021).
3. Topologie custom rámu a max. rozteč sloupků 2 400 (D-016). Limity R07: custom 2 sloty, ISO 1 slot (D-019).
4. Data kontejneru: tara 2 250 kg, těžiště, rohový sloupek 150 mm, plech 18 kg/m², dveře 280 kg.
5. Max. rozteč podpěr osazení 2 000 mm. Zda do podpěr započítat užitné zatížení a sníh (D-015).
6. `doorClearDepth_mm` 600, `flueMinRoofEdgeDistance_mm` 300, výšky větracích mřížek 300 / 300.
7. Ložné výšky vozidel (HR 1 250, podvalník…), tabulka jističů a kabelů (ověří elektroprojektant).
