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
| M4 – API + výstupy | **hotovo** – viz [docs/M4.md](docs/M4.md), ukázkové PDF/XLSX [docs/m4/](docs/m4/) |
| M5 – Admin + seed | **hotovo** – viz [docs/M5.md](docs/M5.md), screenshoty [docs/m5/](docs/m5/) |
| M6 – Kvalita | **hotovo** – viz [docs/M6.md](docs/M6.md), akceptace [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) |

## Vývoj

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @sauna/core report   # docs/reference/ref-*.md pro ruční ověření
pnpm --filter @sauna/viewer demo   # demo vieweru (klávesy 1/2/3, S řez, P snímky, M posun kamen)
pnpm dev                           # konfigurátor na http://localhost:5173/?tenant=demo (bez API: localStorage)
pnpm --filter @sauna/api dev       # API na :3000 (PGlite, demo tenant); konfigurátor s VITE_API_BASE=http://localhost:3000
VITE_API_BASE=http://localhost:3000 pnpm --filter @sauna/admin dev   # administrace na :5174
pnpm e2e                           # testy v Chromiu (viewer + embed/konfigurátor + API + admin), výstupy do docs/m2–m5
pnpm --filter @sauna/e2e lighthouse # Lighthouse: stránka hostitele bez/s embedem → docs/m6
pnpm --filter @sauna/e2e full      # celý tok hostitel → poptávka → e-maily → admin, 2 tenanti → docs/m6
```

API testy na skutečném PostgreSQL: `TEST_DATABASE_URL=postgres://… pnpm --filter @sauna/api test`.

### Docker Compose

```sh
docker compose up --build
```

Stránka hostitele s embedem na http://localhost:8080/, konfigurátor na `/configurator/`, admin na `/admin/`
(`admin@demo-sauny.example`, magic link v Mailpitu na http://localhost:8025/), API na http://localhost:3000.

## Použití core

```ts
import { evaluate } from '@sauna/core';
const e = evaluate(config, catalog);
e.bomRows; e.mass; e.lift; e.supports; e.transport; e.sauna; e.price; e.violations; e.scene;
```

Rozhodnutí: [docs/DECISIONS.md](docs/DECISIONS.md)
