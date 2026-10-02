# Akceptační kritéria MVP – doklady

| Kritérium | Doklad |
|---|---|
| Konfigurační JSON jako jediný zdroj pravdy; stejný výpočet na klientu i serveru | `@sauna/core` `evaluate()`; full-flow: cena server = klient (410 821 Kč) – [M6](M6.md) |
| Pravidla R1–R10 jako data, opravy jedním klikem | `packages/core/src/packs/sauna`, testy core; e2e M3 (R02, R04) a M6 (R01) |
| BOM, hmotnost, těžiště, reakce, doprava | referenční reporty `docs/reference/ref-*.md` – [M1](M1-PROPOSAL.md) |
| 3D viewer: řez, sloty, snímky, výkon na mobilu | [M2](M2.md), viewer e2e (interaktivní < 3,1 s na slow 4G) |
| Konfigurátor < 250 kB gzip, embed loader < 5 kB | [M3](M3.md); `embed.js` 1,57 kB gzip |
| Embed nezhorší stránku výrobce o víc než 5 bodů Lighthouse | [M6](M6.md): pokles 0, CLS 0 |
| Události pro GA4/GTM, žádné cookies | e2e M3 (`dataLayer`, 0 cookies) |
| Poptávka → PDF nabídka, technický list, BOM XLSX, e-maily do 1 minuty | e2e M4 a M6 (≈ 6 s), ukázky v `docs/m4/` |
| Jazyky cs/de/en, měny CZK/EUR | [M3](M3.md), [M4](M4.md) |
| Admin: poptávky, katalog s verzemi, XLSX, sazby, theming | [M5](M5.md), `e2e:admin` |
| Nová položka katalogu bez změny kódu | test API (kamna) a `e2e:admin` (okno 1 200 × 600) |
| Izolace tenantů | `apps/api/test/isolation.test.ts` (21 testů) + full-flow (admin jiného tenanta) |
| Lokální běh přes Docker Compose | `docker-compose.yml` – [M6](M6.md) (image neověřené, chybí Docker daemon) |
| Žádné tajné klíče v repu | `.env.example`, secret webhooku jen zápis (D-052) |

## Otevřené body (nejsou chybou MVP, potřebují vstup výrobce)

- Parametry kamen v demo katalogu jsou **placeholder**. Před ostrým provozem je potřeba je ověřit podle manuálů výrobců.
  Validace katalogu na to upozorňuje.
- Statika: užitné zatížení a sníh na střeše/terase se do reakcí podpěr zatím nezapočítávají, jen prázdná hmotnost (D-015, tuhé těleso dle Q1 a).
  Hodnoty je potřeba potvrdit.
- Doprava: vzdálenost je zatím paušální výchozí hodnota z ceníku, převod PSČ → km není implementovaný.
- Soubory (foto, snímky, PDF) jsou v PostgreSQL (`bytea`). Při větším provozu je přesunout do objektového úložiště (S3).
