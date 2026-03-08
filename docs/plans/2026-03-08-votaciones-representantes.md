# Votaciones Representantes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Load individual legislator votes from the Cámara de Representantes into the database using the public `DAvotaciones.json` endpoint, cross-referenced with session diary PDFs for project names.

**Architecture:** New pipeline step that (1) fetches the JSON vote data, (2) fetches session diary PDFs for project name context, (3) matches votes to projects by vote count, (4) loads everything into the existing DB schema via `cargarSesion`.

**Tech Stack:** TypeScript, fetch API, pdf-parse (already a dependency), Drizzle ORM, Vitest

---

### Task 1: Scraper — fetch DAvotaciones.json and diary index

**Files:**
- Create: `packages/pipeline/src/scraper/votaciones-representantes.ts`
- Test: `packages/pipeline/tests/scraper/votaciones-representantes.test.ts`

**Steps:**
1. Create scraper with types (`VotacionRepresentantes`, `DiarioSesion`) and fetch functions
2. Write tests with mocked fetch
3. Run tests, verify pass
4. Commit

---

### Task 2: Parser — extract project names from PDF and match to votes

**Files:**
- Create: `packages/pipeline/src/parser/parser-diario-representantes.ts`
- Test: `packages/pipeline/tests/parser/parser-diario-representantes.test.ts`

**Steps:**
1. Create parser that extracts `(Se vota)` sections from PDF text, parses Representantes vote formats ("N votos afirmativos y M negativos en T", "N en M: AFIRMATIVA", "N por la afirmativa: AFIRMATIVA")
2. Create matching function that pairs JSON votes with diary votes by count comparison
3. Create project name extractor
4. Write tests for all three components
5. Run tests, verify pass
6. Commit

---

### Task 3: Seed legislators from JSON data

**Files:**
- Create: `packages/pipeline/src/seed/legisladores-representantes.ts`
- Test: `packages/pipeline/tests/seed/seed-representantes.test.ts`

**Steps:**
1. Create seed that extracts unique names from DAvotaciones.json and inserts as legislators
2. Include party mapping for known diputados
3. Write tests with mocked fetch
4. Run tests, verify pass
5. Commit

---

### Task 4: Loader and CLI integration

**Files:**
- Create: `packages/pipeline/src/loader/cargador-votaciones-representantes.ts`
- Test: `packages/pipeline/tests/loader/cargador-votaciones-representantes.test.ts`
- Modify: `packages/pipeline/src/cli.ts`
- Modify: `Dockerfile`

**Steps:**
1. Create loader that orchestrates: seed legislators, fetch votes, fetch diaries, match, load via `cargarSesion`
2. Add `representantes` CLI command
3. Add representantes step to Dockerfile
4. Write integration test
5. Run full test suite
6. Commit

---

### Task 5: Run locally, verify, push and deploy

**Steps:**
1. Build pipeline
2. Run `representantes` command locally
3. Verify DB has ~6800 individual votes across ~99 legislators
4. Run full test suite
5. Push to trigger deploy
