# M1 – návrh struktury a typů (ke schválení)

Stav: **návrh**. Typy jsou v `packages/core/src/model/*` a projdou `tsc --strict`.
Logika zatím není implementovaná. S implementací začnu po schválení a zodpovězení otázek v sekci 5.

## 1. Struktura repozitáře

```
/
├─ package.json, pnpm-workspace.yaml, tsconfig.base.json, .env.example
├─ docs/
│  ├─ DECISIONS.md            rozhodnutí (D-xxx) + otevřené otázky
│  └─ M1-PROPOSAL.md          tento dokument
├─ packages/
│  ├─ core/                   čistý TS (bez DOM a Three.js), Vitest
│  │  └─ src/
│  │     ├─ model/            ← TYPY KE SCHVÁLENÍ
│  │     │  ├─ units.ts       Mm, Kg, Czk, Vec3, souřadný systém
│  │     │  ├─ config.ts      Config (zdroj pravdy), Opening, Zone, Attachment…
│  │     │  ├─ catalog.ts     katalog tenanta: ocel, profily, panely, skladby, kamna…, Limits, Rates
│  │     │  ├─ scene.ts       SceneNode (abstraktní 3D)
│  │     │  ├─ bom.ts         BomLine, BomRow, AssemblyId
│  │     │  ├─ slots.ts       SlotLayout
│  │     │  ├─ component.ts   ComponentBuilder, BuildContext, Penetration
│  │     │  ├─ rules.ts       RuleDef (data), Condition DSL, Violation, AutoAddition
│  │     │  ├─ results.ts     Evaluation: hmotnost, těžiště, reakce, doprava, cena…
│  │     │  ├─ productLine.ts ProductLinePack (rozhraní pro fitness/glamping/pool)
│  │     │  └─ api.ts         evaluate(config, catalog) → Evaluation
│  │     ├─ fixtures/         3 referenční konfigurace (+ demo katalog v M1)
│  │     │  (implementace M1:)
│  │     ├─ catalog/          CatalogIndex, validace katalogu
│  │     ├─ geometry/         ModuleGeometry ze skladeb, sloty (slots.ts)
│  │     ├─ shell/            builders: frame.custom, frame.iso, wall, roof, floor, opening, attachments
│  │     ├─ packs/sauna/      builders (heater, benches, lighting, interior), facts, checks R01–R10
│  │     ├─ rules/            Condition evaluator, rule engine, patch apply
│  │     ├─ calc/             mass, cog, liftReactions, supports, transport, saunaVolume, electrical, price
│  │     ├─ bom/              aggregate, pos numbering
│  │     └─ evaluate.ts
│  └─ viewer/                 M2 – Three.js
└─ apps/
   ├─ configurator/           M3 – Preact + Vite (iframe)
   ├─ embed/                  M3 – loader < 5 kB
   ├─ api/                    M4 – Fastify + Drizzle + Postgres
   └─ admin/                  M5 – Preact
```

## 2. Datový tok `evaluate(config, catalog)`

```
Config (zdroj pravdy, jen záměr zákazníka)
  │ CatalogIndex (SKU → položka; neznámé SKU = výjimka)
  ▼
ModuleGeometry  ← skladby stěn/střechy/podlahy z katalogu (vnitřní světlé rozměry)
SlotMap         ← stěny N/S/E/W, příčky P1…, střecha; zbytky = fixní doplňkové panely
Facts           ← ploché odvozené hodnoty (objem, sklo, kamna.fuel, délky zón…)
  ▼
auto pravidla (R05, R07, R09, R06)  → AutoAddition[] (komponenty navíc, config se NEmění)
  ▼
ComponentInstance[] (stabilní id) → builder(params, ctx) → { SceneNode, BomLine[], Penetration[] }
  ▼
agregace BOM, hmotnost po sestavách, těžiště, reakce, opory, doprava, sauna report, cena
  ▼
error/warning pravidla → Violation[] (+ suggestedFix jako JSON Patch)
  ▼
Evaluation (verzované schéma) – stejná na klientu i serveru
```

## 3. Klíčové typy (výtah)

- **`Config`** – diskriminovaný union podle `productLine`. `ShellConfig` je společný obal
  (modul, plášť, otvory, přídavky, osazení, místo dodání), `SaunaConfig` přidává `zones` a `sauna`.
  Proti zadání jsou tu tato rozšíření:
  - `heater` má umístění (`wall`, `along_mm`), jinak nejde kontrolovat kolizní obal (R02) ani pozice kouřovodu (R05).
  - `benches` má `system` (výšky a hloubky úrovní jsou v katalogu), `wall`/`returnWall` a rozsah.
  - `lighting` má navíc montážní místo a počet.
  - `Opening.door` (pant, směr otevírání) slouží pro R04. Otvor může ležet i v příčce `P1`, tam jsou dveře do sauny.
  - Přídavky (`attachments`) jsou typovaný union (terasa, přesah střechy, schody, zábradlí).
  - `delivery` (PSČ, km) slouží pro cenu dopravy. Bez něj se použije výchozí vzdálenost tenanta.
- **`Catalog`** – jedno pole pro každý druh položky (budoucí listy XLSX). Každé oborové číslo má `Source`
  s příznakem `placeholder`. `Limits` drží všechny prahy pravidel, `Rates` sazby a marže.
  `FrameRecipe` určuje, který profil se použije pro kterou roli prutu. Topologie rámu jsou tedy data.
- **`BomLine`** – podle zadání a navíc `componentId`, `category` (list XLSX), `surface_m2` (nátěr),
  `labour_h` a `transport: 'fixed' | 'demounted'` (přepravní hmotnost).
  `mass_kg` je **celková netto** hmotnost řádku, prořez se nepřepravuje. `cost` zahrnuje prořez a práci.
- **`SceneNode`** – group / box / extrude (2D průřez z core) / instances / panel s otvory / asset (GLB).
  `GroupNode.hash` umožní vieweru diffovat podle id komponent.
- **`RuleDef`** – data: `when` (podmínka nad Facts), `check` = buď výraz (`expr`), nebo pojmenovaná
  čistá funkce z registru balíčku (`fn` + parametry), `action` pro auto pravidla, `fix`.
  Prahy se čtou z `Limits` přes `{ limit: '…' }`.
- **`Evaluation`** – vše odvozené včetně `submittable` (žádná chyba).

## 4. Plán implementace M1

1. Demo katalog jako fixture: profily se správnými kg/m podle EN 10219-2 / EN 10279 / EN 10056-1, kamna jako placeholder.
2. Geometrie a sloty, builders rámu (custom + ISO), stěn a pláště, střechy, podlahy, otvorů, výztuh.
3. Builders sauny: kamna, lavice, světla, interiér, větrání, komín.
4. Výpočty: hmotnost, těžiště, reakce, opory, doprava, objem sauny, elektro, cena.
5. Rule engine + R01–R10 + fixy.
6. Testy: unit test každého pravidla, snapshot BOM pro REF-1..3, ocel Σ(kg/m × délka) ±0,5 %,
   těžiště symetrického modulu = geometrický střed, determinismus (2× evaluate = shodný JSON).

## 5. Otázky – potřebuji tvé rozhodnutí (statika a konstrukce)

**Q1 – Reakce ve 4 závěsných bodech.** Úloha je 1× staticky neurčitá. Navrhuji
(a) tuhé těleso na 4 stejně tuhých podporách, tj. lineární rozdělení:
`R_i = G·[1/4 + (x_T−x̄)(x_i−x̄)/Σ(x_j−x̄)² + (y_T−ȳ)(y_i−ȳ)/Σ(y_j−ȳ)²]`.
Alternativa (b) je bilineární rozdělení `R_A = G(1−ξ)(1−η)`…
Závěsy se v obou případech berou jako svislé (vahadlo/rám). Při zavěšení na jeden hák se šikmými lany
by se síly v lanech lišily úhlem a v MVP to neřeším. Kterou variantu použít?
Varování „liší se o více než 25 %“ počítám jako `(Rmax − Rmin)/Rmean > 0,25`. Souhlasí to?

**Q2 – Sloty na čelních stěnách.** Šířky 2 300 a 2 500 nejsou násobkem rastru 600.
Návrh: osa slotů je centrovaná, zbytek se rozdělí do dvou fixních doplňkových pásů u rohů
(2 300 → 3 sloty × 600 + 2 × 250, mínus rohové sloupky). Je to v pořádku, nebo chceš na čelech pevné varianty panelů?

**Q3 – Výška custom modulu.** V zadání chybí rozsah `H_mm`. Je pevná (a kolik), nebo volitelná?
Pro fixtures zatím používám 2 700 mm.

**Q4 – Topologie custom rámu (FrameRecipe).** Návrh, uvidíš ho jako data:
spodní obvod RHS 100×100×4, příčníky podlahy U 120 po 600, rohové sloupky RHS 80×80×3,
mezilehlé sloupky RHS 60×40×3 jen na hranách otvorů, horní obvod RHS 80×80×3,
střešní vaznice RHS 60×40×3 po 600, výztuž otvoru L 50×5 nebo RHS 60×40×3,
závěsná oka v horních rozích. Opravíš to, nebo pošleš výkres?

**Q5 – ISO 20′ HC.** Kontejner beru jako nakupovaný díl s hmotností a těžištěm z katalogu.
Úpravy jsou samostatné řádky BOM: výřezy (odečet plechu), výztužné rámy otvorů, vnitřní rošt, izolace, obklad.
Hodí se tento model? A jaký je limit slotů bez výztuže pro ISO a pro custom (R07: [N])?

**Q6 – Skladby stěn.** Pro vnitřní objem sauny potřebuji referenční skladby: stěna, střecha, podlaha
a příčka pro custom i ISO (vrstvy, tloušťky, kg/m²). Pošli je prosím, nebo navrhnu typickou
(plášť 26 + latě 25 + difuzní fólie + KVH/minerální vata 100 + Al parozábrana + latě 25 + obklad 15)
a označím ji jako placeholder.

**Q7 – Přepravní výška.** `výška na vozidle = H_mm + výška ložné plochy vozidla` (z katalogu,
návrh: HR 1 250 mm, podvalník 900 mm jako placeholder). Je to tak správně?

**Q8 – Kamna na dřevo a příčka.** U REF-2 stojí kamna u příčky. Mají se kamna na dřevo obsluhovat
z převlékárny (průchod příčkou), nebo jen zevnitř sauny? To mění R02 i R05.

Drobnosti jsem rozhodl sám a jsou v `docs/DECISIONS.md` (D-001 až D-012). Můžeš je kdykoli změnit.
