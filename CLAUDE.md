# como-voto-uy

Plataforma de transparencia legislativa para Uruguay.

## Estructura

Monorepo con pnpm workspaces + Turborepo:
- `packages/shared` — Schema Drizzle, tipos, constantes
- `packages/pipeline` — Scraper, parser, loader (CLI)
- `packages/web` — Next.js App Router

## Convenciones

- Idioma del código (modelos, variables, tipos): **español**
- DB: SQLite + Drizzle ORM
- Testing: Vitest
- Build: tsup (shared, pipeline), Next.js (web)

## Comandos

```bash
pnpm install          # instalar dependencias
pnpm build            # turbo build (todos los paquetes)
pnpm test             # turbo test (todos los tests)
pnpm dev              # turbo dev (web en dev mode)
```

## Pipeline CLI

```bash
cd packages/pipeline
pnpm cli seed         # seed datos de referencia
pnpm cli scrape       # descargar taquigráficas
pnpm cli parse        # parsear votos
pnpm cli load         # cargar a SQLite
pnpm cli all          # ejecutar todo el pipeline
```
