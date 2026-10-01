# Sauna Configurator MVP

B2B white-label 3D konfigurátor modulárních saun (custom ocelový rám, ISO 20′ HC).
Zdroj pravdy je konfigurační JSON. Validace, BOM, hmotnost, těžiště, cena i 3D scéna se z něj generují deterministicky přes `@sauna/core`.

## Stav

| Milník | Stav |
|---|---|
| M1 – Core | **návrh typů ke schválení** – viz [docs/M1-PROPOSAL.md](docs/M1-PROPOSAL.md) |
| M2 – Viewer | – |
| M3 – Configurator + embed | – |
| M4 – API + výstupy | – |
| M5 – Admin + seed | – |
| M6 – Kvalita | – |

## Vývoj

```sh
pnpm install
pnpm typecheck
pnpm test
```

Rozhodnutí: [docs/DECISIONS.md](docs/DECISIONS.md)
