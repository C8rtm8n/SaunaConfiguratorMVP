# Sauna Configurator MVP

B2B white-label 3D konfigurátor modulárních saun (custom ocelový rám, ISO 20′ HC).
Zdroj pravdy je konfigurační JSON. Validace, BOM, hmotnost, těžiště, reakce, doprava, cena i 3D scéna se z něj generují
deterministicky přes `@sauna/core`. Stejný kód běží na klientu i na serveru.

## Stav

| Milník | Stav |
|---|---|
| M1 – Core | **hotovo** – viz [docs/M1-PROPOSAL.md](docs/M1-PROPOSAL.md), reporty [docs/reference/](docs/reference/) |
| M2 – Viewer | **hotovo** – viz [docs/M2.md](docs/M2.md), screenshoty [docs/m2/](docs/m2/) |
| M3 – Configurator + embed | **hotovo** – viz [docs/M3.md](docs/M3.md), screenshoty [docs/m3/](docs/m3/) |
| M4 – API + výstupy | – |
| M5 – Admin + seed | – |
| M6 – Kvalita | – |

## Vývoj

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @sauna/core report   # docs/reference/ref-*.md pro ruční ověření
pnpm --filter @sauna/viewer demo   # demo vieweru (klávesy 1/2/3, S řez, P snímky, M posun kamen)
pnpm dev                           # konfigurátor na http://localhost:5173/?tenant=demo
pnpm e2e                           # testy v Chromiu (viewer + embed/konfigurátor), výstupy do docs/m2, docs/m3
```

## Použití core

```ts
import { evaluate } from '@sauna/core';
const e = evaluate(config, catalog);
e.bomRows; e.mass; e.lift; e.supports; e.transport; e.sauna; e.price; e.violations; e.scene;
```

Rozhodnutí: [docs/DECISIONS.md](docs/DECISIONS.md)
