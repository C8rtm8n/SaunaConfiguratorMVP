# Rozhodnutí

Formát: **D-xxx – název.** Rozhodnutí. *Proč.* Stav: přijato / návrh (čeká na potvrzení).

- **D-001 – Monorepo.** pnpm workspaces, TS strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.
  Balíčky se v rámci workspace odkazují přímo na `src/*.ts`, bez build kroku. *Jednodušší vývoj, Vite i Vitest TS zvládnou.* Stav: přijato.
- **D-002 – Jednotky.** mm, kg, Kč bez DPH, m² a m³ jen u jednotkových cen a objemu, kN u reakcí. Typy jsou aliasy
  (`Mm`, `Kg`, `Czk`), ne branded typy. *Branded typy by v aritmetice překážely víc, než by pomohly.* Stav: přijato.
- **D-003 – Config = záměr, Evaluation = odvozeno.** Auto pravidla config nemění, vrací `AutoAddition`.
  *Uložená konfigurace se po změně katalogu nebo pravidel nerozbije a server přepočítá deterministicky.* Stav: přijato.
- **D-004 – Souřadnice a stěny.** Počátek je levý přední dolní vnější roh, X = délka, Y = šířka, Z = výška.
  S: y = 0 (dlouhá „přední“), N: y = W, W: x = 0, E: x = L (čela). Příčky P1… jsou kolmé na X.
  Stav: **návrh** (potvrď, že „přední“ je dlouhá stěna).
- **D-005 – Zóny po ose X.** Zóny na sebe navazují a pokrývají celou délku. Hranice = osa příčky v rastru.
  Stav: přijato.
- **D-006 – Poloha kamen.** `wall` + `along_mm` (osa kamen od začátku stěny). Odstup od stěny určují zadní odstupy z katalogu.
  Stav: přijato.
- **D-007 – Zbytky slotů.** Co nevyjde do rastru, tvoří fixní doplňkové panely bez otvorů. Stav: **návrh** (Q2).
- **D-008 – Topologie rámu jako data** (`FrameRecipe`: role prutu → profil, max. rozteč). *Nový profil nevyžaduje změnu kódu.*
  Stav: přijato. Konkrétní obsah: návrh (Q4).
- **D-009 – Pravidla jako data.** `when`/`expr` je JSON podmínka nad `Facts`. Geometrické kontroly jsou pojmenované
  čisté funkce z registru balíčku, parametrizované daty. *Kolize obalů se v rozumném DSL vyjádřit nedají.
  Editor pravidel v adminu tak zůstává možný.* Stav: přijato.
- **D-010 – Reakce v závěsných bodech.** Výchozí je tuhé těleso na 4 stejně tuhých podporách. Stav: **návrh** (Q1).
- **D-011 – Cena.** `price = cost × (1 + marže kategorie)`. Kategorie: steel, timber, purchased, labour, transport, crane.
  Katalog drží jen nákupní ceny. Rozpětí ±`priceRange`. EUR jen v prezentaci (`eurPerCzk`). Stav: přijato.
- **D-012 – BOM.** `mass_kg` je celková netto hmotnost řádku, `cost` zahrnuje prořez. Builder vrací řádky s těžištěm,
  pozice (`pos`) se přidělují až po agregaci deterministicky. Stav: přijato.
