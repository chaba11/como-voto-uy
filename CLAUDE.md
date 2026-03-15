# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

**Cómo Votó? UY** — Plataforma de transparencia legislativa para Uruguay. Monorepo con pnpm workspaces + Turborepo.

## Comandos

```bash
pnpm install          # instalar dependencias
pnpm build            # turbo build (todos los paquetes)
pnpm test             # turbo test (todos los tests)
pnpm lint             # turbo lint (todos los paquetes)
pnpm dev              # turbo dev (web en dev mode)
```

Correr un solo test:

```bash
cd packages/pipeline && pnpm vitest run tests/parser/detector-votacion.test.ts
```

Pipeline CLI:

```bash
cd packages/pipeline
pnpm cli seed                          # seed datos de referencia
pnpm cli scrape                        # listar sesiones disponibles
pnpm cli parse                         # descargar y parsear votos
pnpm cli load                          # pipeline completo (scrape+parse+load)
pnpm cli all                           # load con reset de DB
pnpm cli afiliaciones                  # cargar afiliaciones históricas
pnpm cli representantes               # pipeline para representantes
pnpm cli cobertura                     # reporte de cobertura
# Opciones: --camara=senado|representantes --legislatura=50 --limite=N
```

## Estructura del monorepo

- **`packages/shared`** — Schema Drizzle (`src/schema.ts`), tipos (`src/tipos.ts`), constantes legislativas (`src/constantes.ts`). Build: tsup.
- **`packages/pipeline`** — CLI de ingesta de datos. Build: tsup.
- **`packages/web`** — Next.js App Router (React 19, Tailwind CSS 4). Se conecta a la DB en modo read-only.

## Arquitectura del pipeline

Flujo de datos: **scrape → parse → load**

1. **Scraper** (`src/scraper/`) — descarga taquigráficas del parlamento.gub.uy, extrae texto de HTML/PDF
2. **Parser** (`src/parser/`) — detecta votaciones en el texto, extrae votos nominales, resultados agregados, proyectos y asistencia. Normaliza nombres de legisladores con sistema de alias y confianza.
3. **Loader** (`src/loader/`) — carga a SQLite con deduplicación inteligente de asuntos (por código oficial, carpeta+repartido, o nombre)

Orquestación principal en `src/pipeline.ts`, entry point CLI en `src/cli.ts`.

## Base de datos

SQLite + Drizzle ORM. Schema en `packages/shared/src/schema.ts` (13 tablas).

Tablas principales: `partidos`, `legisladores`, `sesiones`, `votaciones`, `votosIndividuales`, `asuntos`, `resultadosAgregados`.

Patrón de conexión:
- Pipeline: read-write con WAL mode y foreign keys ON (`packages/pipeline/src/db/conexion.ts`)
- Web: read-only (`packages/web/src/lib/db.ts`)

Config via env vars: `DB_PATH` (default: `como-voto.db`), `DATOS_DIR` (default: `./data`)

## Convenciones de código

- **Idioma**: todo en español — nombres de variables, funciones, tipos, tablas, comentarios
- **Formato**: sin semicolons, single quotes, trailing commas, 100 chars de ancho (Prettier)
- **Unused vars**: deben empezar con `_` (regla ESLint)
- **TypeScript**: strict mode, target ES2022, moduleResolution bundler
- **Testing**: Vitest con global APIs, fixtures en `tests/fixtures/`
- **Datos**: toda la data lleva niveles de confianza (`confirmado`, `alto`, `medio`, `bajo`) y evidencia de origen
