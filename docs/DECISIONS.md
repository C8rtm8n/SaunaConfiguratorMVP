# Rozhodnutí

Formát: **D-xxx – název.** Rozhodnutí. *Proč.* Stav: přijato / schváleno / návrh (čeká na potvrzení).
Každé číslo z oboru je v katalogu (`Limits`, `Rates`, položky) se zdrojem. `placeholder: true` znamená, že hodnotu je potřeba ověřit.

## Architektura

- **D-001 – Monorepo.** pnpm workspaces, TS strict + `noUncheckedIndexedAccess`. Balíčky se ve workspace odkazují přímo na `src/*.ts`, bez build kroku.
  `exactOptionalPropertyTypes` jsem vypnul, protože víc překážel, než pomáhal. Stav: přijato.
- **D-002 – Jednotky.** mm, kg, Kč bez DPH, m² a m³ jen u jednotkových cen a objemu, kN u reakcí. Typy jsou aliasy (`Mm`, `Kg`, `Czk`), ne branded typy.
  Zaokrouhluje se jen v prezentaci a ve snapshotech. Stav: přijato.
- **D-003 – Config = záměr, Evaluation = odvozeno.** Auto pravidla config nemění, vrací `AutoAddition`
  (komponenty navíc + poznámka). *Uložená konfigurace se po změně katalogu nebo pravidel nerozbije.* Stav: přijato.
- **D-009 – Pravidla jako data.** `RuleDef` = `when` (JSON podmínka nad `Facts`) + `check` (výraz `expr` nebo pojmenovaná funkce `fn`)
  + `action` (auto) + `fix`. Prahy se čtou z `Limits` (`{ limit: 'doorMinClearWidth_mm' }`). Funkce vracejí `Finding` s variantou,
  zprávu vybírá engine z `rule.messages[variant]`. Opravy jsou JSON Patch (RFC 6902) a UI je aplikuje jedním klikem. Stav: přijato.
- **D-020 – Číslování pravidel.** R01–R10 podle zadání. R03 je rozdělené na R03 (error, min. výška kamen) a R03b (warning, lavice–strop),
  R05 na R05 (auto komín) a R05b (error odstupy kouřovodu). Navíc S01 (otvory ve slotech), S02 (zóny), S03 (přídavky), S10 (umístění v sauně),
  M01 (rozptyl reakcí > 25 %, warning) a T01 (nadrozměr, warning). Stav: přijato.
- **D-014 – Scéna je osově zarovnaná.** Modul je pravoúhlý, takže `SceneNode` nemá Eulerovy rotace. Panely mají `plane: xz|yz|xy`,
  pruty `from → to` rovnoběžně s osou, průřez je polygon z core. Diff ve vieweru: `GroupNode.id` + `hash` obsahu. Stav: přijato.

## Geometrie

- **D-004 – Souřadnice a stěny.** Počátek je levý přední dolní roh modulu, X = délka, Y = šířka, Z = výška.
  S: y = 0 (dlouhá, „přední“), N: y = W, W: x = 0, E: x = L (čela). Příčky P1… jsou kolmé na X. Stav: přijato (bez námitek).
- **D-013 – Co znamenají L/W/H.** *custom_frame:* L/W/H jsou hotové vnější rozměry (přes plášť a krytinu) a ocelový rám je odsazený
  o vnější vrstvy skladby (stěna 52 mm, střecha 108 mm, podlaha 1 mm). *iso_20hc:* L/W/H jsou rozměry kontejneru, plášť je přidaný vně
  (šířka 2 438 + 2 × 52 = 2 542 mm). Pevná výška custom modulu je 2 700 mm (Q3). Stav: přijato.
- **D-005 – Zóny po ose X.** Navazují na sebe a pokrývají celou délku. Hranice je osa příčky v rastru (`x % grid = 0`), příčka je symetrická k ose. Stav: přijato.
- **D-006 – Poloha kamen.** `wall` + `along_mm`. `along_mm` je **souřadnice modulu** (x pro S/N, y pro E/W/P), ne vzdálenost od začátku stěny.
  Za kamny je mezera odpovídající zadnímu odstupu z katalogu. Stav: přijato.
- **D-007 – Sloty (Q2).** Na každé ploše jsou sloty centrované (`n = floor(délka / grid)`) a zbytek tvoří dva stejné doplňkové pásy u rohů.
  Vnější stěny a střecha se měří na obálce (custom 4 200 → 7 slotů, 2 300 → 3 sloty + 2 × 250), příčky na vnitřní šířce.
  Otvor je vystředěný ve svém rozsahu slotů a musí se vejít mezi rohové sloupky (custom: šířka rohového profilu, ISO: `cornerPost_mm`).
  Prosklené čelo (`fullWall`) zabírá všechny sloty stěny. Stav: přijato.
- **D-008 / D-016 – Topologie custom rámu (Q4), data ve `FrameRecipe`.** Spodní rám RHS 100×100×4 (podélníky v plné délce, čela mezi nimi),
  příčníky podlahy RHS 60×40×3 po ≤ 600 lícující s horní hranou, horní rám RHS 80×80×3, střešní nosníky RHS 60×40×3 po ≤ 600,
  rohové sloupky RHS 80×80×3. Mezilehlé sloupky RHS 80×80×3 stojí po obou stranách každého otvoru (vně hrubého otvoru) a v ostatních
  úsecích se doplní rovnoměrně tak, aby rozteč nepřekročila 2 400. Když ideální poloha padne do otvoru, sloupek se posune na nejbližší volnou
  hranu slotu, jinak úsek přemostí výztuha R07. U 120 slouží jako pražce (osazení „beams“), L 50×5 jako výztuha otvorů u ISO.
  Spoje jsou tupé, svary a plechy styčníků nejsou v BOM. Stav: **návrh – ověřit statikem**.
- **D-018 – Plochy vrstev.** Vrstvy vně konstrukce se počítají na rozměrech obálky, výplň konstrukce na rozměrech konstrukce a vnitřní
  vrstvy na vnitřním světlém prostoru (u S/N stěn minus tloušťka příček). Otvory se odečítají ze všech vrstev, těžiště řádku je plošně vážené
  (hrubá plocha − otvory). Přesah v rozích (t × t × h) se počítá dvakrát a vejde se do prořezu. Latě: délka = plocha / rozteč, výplň
  = plocha × (1 − šířka latě / rozteč). Výplň ocelového rámu se počítá přes celou plochu bez odečtu profilů. Stav: přijato.
- **D-019 – ISO 20′ HC (Q5).** Kontejner je jeden nakupovaný řádek (tara + těžiště z katalogu). Každý výřez je řádek se **zápornou**
  hmotností (plocha × `wallSheet_kg_per_m2`) a prací za řez. Prosklené čelo na straně dveří kontejneru odečte hmotnost dveří.
  Výztuha L 50×5 (záhlaví + ostění + parapet, je-li) se dává u ISO každému otvoru širšímu než 1 slot, u custom širšímu než 2 sloty (R07).
  Stav: **návrh – limity ověřit statikem**.
- **D-021 – Skladby (Q6).** Placeholder skladby v katalogu: stěna custom 26 + 25 + 1 | rám 80 (MW 80) | 50 (MW 50) + Al + 25 + 15 = 223 mm,
  střecha 35 + 50 + 1 + OSB 22 | 80 | 91, podlaha plech 1 | 100 (MW 100) | OSB 22 + 28, příčka 15 + 25 + Al + KVH 95 (MW 100) + 15 = 151.
  ISO: stěna kontejneru 43 mm, střecha 40 mm, podlaha 158 mm. Stav: **placeholder – pošli skutečné skladby**.

## Sauna

- **D-022 – Lavice.** Systém lavic v katalogu definuje úrovně (výška horní hrany, hloubka). Konfigurace bere horních N úrovní. Nejvyšší
  úroveň je u stěny, nižší vystupují do prostoru. Lavice do L má vratnou větev od čela hlavní lavice (`returnLength_mm`, výchozí hodnota
  z katalogu). Krajní podpěry jsou vždy dvě na segment, mezilehlé doplní R09 (`ceil(L / maxSpan) − 1`). Stav: přijato.
- **D-023 – Kolize (R02, R04).** Kolizní obal kamen = kryt + boční odstup do stran, zadní odstup + hloubka + přední odstup od stěny
  a horní odstup nahoru. Obal se kontroluje proti stěnám místnosti, stropu, objemům lavic (podlaha → horní hrana), sklu
  (pás tloušťky 1 mm na líci stěny) a průchodu za dveřmi (šířka dveří × `doorClearDepth_mm` × výška dveří).
  Oprava R02 hledá nejbližší volnou polohu na stejné stěně v kroku 50 mm. Stav: přijato.
- **D-024 – Kamna na dřevo (Q8).** Obsluhují se jen ze sauny, průchod příčkou se neřeší. Kouřovod jde svisle z osy kamen
  (+ `flue.offset_mm`) skrz střešní slot. Komín je demontovaný díl. Stav: přijato.
- **D-025 – Větrání (R06).** Přívod je na stěně kamen v ose kamen ve výšce `supplyHeight_mm`, odvod na protilehlé stěně u opačného
  konce (`exhaustCornerOffset_mm` od rohu) pod stropem. Mřížky jsou nakupované díly, polohy jsou `penetrations`. Stav: přijato.
- **D-026 – Ekvivalentní objem.** `V + 1,2 × sklo + 1,2 × nezaizolované plochy` (koeficienty v `Limits`). Do sauny se počítá sklo
  ve stěnách místnosti včetně dveří v příčce. U S/N stěn rozhoduje poloha středu otvoru. Stav: přijato.

## Hmotnost, statika, doprava, cena

- **D-010 – Reakce (Q1: varianta a).** Tuhé těleso na n stejně tuhých svislých podporách, reakce jsou lineární v (x, y). Pro 4 rohy:
  `R_i = G·[1/4 + (x_T − x̄)(x_i − x̄)/Σdx² + (y_T − ȳ)(y_i − ȳ)/Σdy²]`. Stejný vzorec platí pro podpěry osazení. Varování M01 se dává
  při `(Rmax − Rmin)/Rmean > 0,25`. Závěsy se berou jako svislé (vahadlo), šikmá lana na jeden hák MVP neřeší. Stav: schváleno.
- **D-015 – Stavy hmotnosti.** *Prázdná* = vše osazené bez základů. *Přepravní* = bez řádků `transport: 'demounted'`
  (komín, terasa, schody, zábradlí, přesah střechy). Závěsné body počítají s přepravní hmotností. Podpěry osazení počítají s prázdnou
  hmotností bez přídavků na vlastních podporách (`ownSupports`) a **bez užitného zatížení a sněhu**. Stav: přijato.
- **D-017 – Doprava (Q7).** Výška na vozidle = výška nepřemístitelných částí + ložná výška vozidla. Vozidlo je první z katalogu, které unese
  přepravní hmotnost (HR ≤ 9 000 kg, jinak vozidlo + autojeřáb). Nadrozměr nastane při šířce > 2 550 nebo výšce > 4 000.
  ISO HC na HR (ložná výška 1 250) vychází na 4 232 mm, tedy nadrozměr. Řešením je podvalník v katalogu. Stav: přijato, ložné výšky jsou placeholder.
- **D-011 – Cena.** Řádek: `price = materiál × (1 + marže kategorie) + práce × (1 + marže práce)`. Práce: svařování h/kg × kg oceli,
  montáž panelů h/m² (u každé položky), montáž nakupovaných dílů h/ks, lavice h/m. Doprava = paušál + Kč/km × vzdálenost
  (výchozí z katalogu, dokud není PSČ → km) + příplatek za nadrozměr. Jeřáb jen u vozidla bez vlastní ruky.
  Zobrazení: skrytá / rozpětí ±10 % / přesná, zaokrouhleno na `priceRounding_czk`. Stav: přijato.
- **D-012 – BOM.** `mass_kg` je celková netto hmotnost řádku, `cost` zahrnuje prořez a práci. Builder vrací řádky s těžištěm,
  `aggregateBom` je seskupí (kategorie, sestava, SKU, délka, přeprava, popis) a přidělí pozice deterministicky: S01… ocel,
  D01… dřevo a plášť, N01… nakupované. Stav: přijato.

## Referenční konfigurace

- **D-027 – Úpravy fixtures.** REF-2 má elektrická kamna 18 kW. Kamna na dřevo s placeholder odstupy (500/500/300) se do sauny
  3,3 × 1,85 m s trojúrovňovou lavicí a dveřmi v příčce nevejdou bez kolize, zadání pro REF-2 typ kamen nepředepisuje.
  Dveře 700 mm zabírají 2 sloty rastru 600. Stav: přijato.

## Viewer (M2)

- **D-028 – Průřez prutů ∥Y.** Lokální osy průřezu pro prut ∥Y jsou (−X, Z), ne (X, Z). Báze je pak pravotočivá pro všechny směry
  a pruty jdou instancovat (`InstancedMesh` nepodporuje zrcadlení po instancích). Asymetrické průřezy (U, L) ∥Y jsou otočené o 180°
  kolem osy prutu, BOM ani hmotnost to neovlivní. Stav: přijato.
- **D-029 – Lamely jako textura spár.** Plášť zůstává panel na slot (kvůli výběru slotu a otvorům). Lamely se kreslí texturou spár
  s roztečí podle krycí šířky prkna z katalogu (`PanelNode.grain`) a orientací podle `cladding.orientation`. Instancují se prkna lavic,
  pruty rámu a boxy. *Geometrie lamel s výřezy otvorů by znamenala tisíce trojúhelníků navíc bez přínosu.* Stav: přijato.
- **D-030 – Diff scény.** Viewer porovnává komponenty v kořeni scény podle `id` + `hash` (hash obsahu podstromu z core).
  Nezměněná komponenta si nechá Three.js objekty, změněná se zahodí a postaví znovu. Posun kamen přestaví jen `heater`, `chimney`
  a `ventilation`. Stav: přijato.
- **D-031 – Řez.** Skryje se střecha (`cutaway: 'roof'`, včetně podhledu) a vnější stěna nejblíže kameře (`wall:X`, plášť, obklad,
  stěna kontejneru). Stěna se vybírá podle polohy kamery vůči středu modulu, normalizované polovičními rozměry, takže řez při
  orbitování sleduje kameru. Nosný rám zůstává vidět. Stav: přijato.
- **D-032 – Výkon.** Render jen na vyžádání (změna kamery, scény, hover), žádná trvalá smyčka. Výchozí kvalita podle třídy zařízení
  (jádra, `deviceMemory`, `pointer: coarse`). Při interakci se z klouzavého mediánu snímků snižuje DPR po 0,25 a nakonec se vypnou
  stíny. Cíl je 60 fps na desktopu a 30 fps na dotykových zařízeních. Bez post-processingu. Loadery GLB/Draco/Meshopt/KTX2 a HDR se
  načítají dynamickým importem, až když jsou potřeba. Stav: přijato.
- **D-033 – Prostředí až po prvním snímku.** PMREM (procedurální `RoomEnvironment`, nebo 1k HDR přes `environmentUrl`) se generuje
  v `requestIdleCallback` po prvním renderu, do té doby svítí hemisférické světlo. V emulaci mobilu to zkrátilo čas do interakce
  z 8,3 s na 2,7 s. Stav: přijato.
- **D-034 – Snímky pro PDF.** `exportSnapshots()` vyrenderuje 4 pohledy (iso zepředu, iso zezadu, čelní pohled na S stěnu,
  iso v řezu) 1 600 × 1 000 na hlavním canvasu v jednom tasku (bez blikání, bez `preserveDrawingBuffer`) a vrací PNG data URL.
  Upload na server je v M4. Stav: přijato.

## Konfigurátor a embed (M3)

- **D-035 – Veřejný katalog s prodejními cenami.** `GET /tenants/:slug/public` vrací katalog, kde je každá nákladová položka už
  vynásobená `(1 + marže kategorie)` a všechny marže jsou 0 (`toPublicCatalog`). Cena je v těchto položkách lineární, takže
  `evaluate` dá v prohlížeči stejnou cenu, BOM i hmotnost jako na serveru (test na REF-1..3), aniž by prohlížeč znal nákupní ceny
  nebo marže. Server zůstává autoritativní: při uložení i u poptávky přepočítá konfiguraci s plným katalogem. Stav: přijato.
- **D-036 – Volby modulu v katalogu.** `catalog.modules`: custom délka 3 600–6 000 po 600, šířky 2 300 / 2 500, pevná výška 2 700,
  rastr 600; ISO = odkaz na kontejner. Průvodce z nich staví ovládací prvky. Stav: přijato.
- **D-037 – Editační operace v core.** `defaultConfig`, `normalizeConfig`, `addOpening`, `setLayout`, `setTerrace`, `setOverhang`.
  Normalizace drží konfiguraci strukturálně konzistentní: rozměry z katalogu, 1–2 zóny s příčkou v rastru, otvory na existujících
  stěnách a ve slotech (posun na nejbližší volnou polohu, neprochází příčkou), stěny kamen a lavic v sauně. Je idempotentní.
  Doménová pravidla (kolize, objem…) dál hlásí `evaluate` a UI nabízí opravy. Stav: přijato.
- **D-038 – Embed protokol.** Zprávy `{ source: 'sauna-configurator', v: 1, type, payload }`. Embed kontroluje `event.origin` (origin
  konfigurátoru) a `event.source` (svůj iframe), konfigurátor posílá jen na `origin` hostitele předaný v URL. Události
  `ready`, `resize`, `step_change`, `price_change` (debounce 600 ms), `config_saved` a `lead_submitted` se na hostiteli vyvolají jako
  `CustomEvent('sauna:<type>')` a jdou do `window.dataLayer` (`sauna_<type>`) pro GA4/GTM. V iframe není žádná analytika ani cookies.
  Iframe se vytvoří při přiblížení do viewportu (rootMargin 200 px), s `data-load="click"` až po kliknutí na poster.
  Výška iframe se řídí obsahem: konfigurátor proto nepoužívá `vh` ani `scrollIntoView`, který by posouval stránku hostitele. Stav: přijato.
- **D-039 – Pořadí načítání.** Průvodce, cena a kontrola (Preact + core) se načtou první (47 kB gzip), 3D (Three.js + viewer,
  168 kB gzip) dynamickým importem. Data demo tenanta (11 kB) se načítají jen bez API. Stav: přijato.
- **D-040 – Ukládání v M3.** Bez API ukládá konfigurátor do `localStorage` svého originu (sdílený odkaz funguje ve stejném
  prohlížeči). `httpRepos` je připravený pro M4 (`VITE_API_BASE`). Sdílený odkaz vede na **stránku výrobce** s `?c=<id>`, embed
  `c` předá do iframe. Stav: přijato pro M3, v M4 server.
- **D-041 – Opravy jedním klikem.** R02 hledá volnou polohu kamen nejdřív na stejné stěně, pak na ostatních stěnách sauny.
  R04 (lavice nebo kamna v průchodu dveří) posune dveře na nejbližší volné sloty, a když to nejde, zkrátí hlavní lavici o průchod
  (zbytek musí mít aspoň polovinu max. rozpětí). Stav: přijato.

## API a výstupy (M4)

- **D-042 – Izolace tenantů v dotazech.** Každá tabulka s daty tenanta má `tenant_id` a každá funkce repozitáře (`repo.ts`) ho dostává
  povinně a filtruje podle něj. Veřejná ID jsou náhodná (`c…`, `l…`, 14 znaků), ne sekvenční. Veřejný `GET/PUT /configs/:id` vyžaduje
  `?tenant=`, admin endpointy berou tenanta jen ze session (ne z URL). Cizí data vrací 404, ne 403. Ověřeno testy
  (export, revize, poptávky, soubory, změna stavu, magic link přes tenanty). Stav: přijato.
- **D-043 – Server je autoritativní.** `POST/PUT /configs` i `POST /leads` konfiguraci znovu normalizují a přepočítají přes core
  s aktivním katalogem tenanta. Uložená revize obsahuje konfiguraci, verzi katalogu a souhrn (cena, náklad, hmotnost, počty chyb).
  Poptávka s chybou (`submittable = false`) se odmítne s 422 i na serveru. Exporty starších revizí se počítají s verzí katalogu,
  se kterou byly uloženy (verze katalogu jsou neměnné). Stav: přijato.
- **D-044 – Exporty.** `bom.csv` (jedna tabulka, oddělovač `;`, UTF-8 BOM pro český Excel), `bom.xlsx` (listy Ocel, Dřevo a plášť,
  Nakupované díly, Souhrn hmotností), `config.json` (konfigurace + všechny výstupy bez 3D scény, `schemaVersion`),
  `offer.pdf` (jazyk zákazníka) a `tech.pdf` (výchozí jazyk tenanta). PDF vzniká z HTML šablony v headless Chromiu bez přístupu
  k síti. Obrázky jsou vložené přímo do HTML, půdorys je SVG z core (`planSvg`). Stav: přijato.
- **D-045 – Admin auth.** Magic link (32 B náhodný token, v DB jen SHA-256, platnost 15 min, jednorázový) → session cookie
  `httpOnly`, `SameSite=Lax`, `Secure` v produkci. Neznámý e-mail dostane stejnou odpověď (204) bez e-mailu. Role `admin`
  a `sales` mají v M4 stejná práva k leadům a exportům, správa katalogu (M5) bude jen pro `admin`. Rate limit: magic link
  5/min, poptávky 10/min, ukládání 60/min na IP. Stav: přijato.
- **D-046 – Fronta úloh v DB.** Tabulka `jobs`, úlohu si worker zamkne přes `FOR UPDATE SKIP LOCKED`, takže API může běžet ve více
  instancích. `lead.process` vyrobí PDF × 2 + XLSX, uloží je k poptávce a pošle e-mail výrobci (přílohy + foto místa) a zákazníkovi
  (nabídka). `lead.webhook` posílá `POST` s hlavičkou `X-Sauna-Signature: t=<unix>,v1=<HMAC-SHA256(secret, "t.body")>`.
  Při chybě se úloha opakuje s exponenciálním čekáním (5 s … 1 h, max. 6 pokusů). Stav: přijato.
- **D-047 – Databáze.** Drizzle ORM, migrace generované `drizzle-kit` ze schématu (`apps/api/drizzle`). Produkce běží na PostgreSQL
  (`DATABASE_URL=postgres://…`), lokální vývoj a testy bez serveru na PGlite (`pglite://memory`), se stejným SQL i migracemi.
  Testy běží na obou (`TEST_DATABASE_URL`). Soubory (foto, snímky, PDF, XLSX) jsou v MVP v tabulce `files` (bytea), objektové
  úložiště řeší M6. Stav: přijato.
- **D-048 – Skrytá cena.** Když tenant cenu nezobrazuje, veřejný katalog nemá žádné ceny (vše 0) a veřejné odpovědi API neobsahují
  `price.total`. Cenu vidí jen výrobce v e-mailu, exportech a souhrnu revize. Stav: přijato.
