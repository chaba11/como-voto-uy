# Integración de votos individuales de Cámara de Representantes

## Contexto

Las taquigráficas del Senado solo registran resultados agregados ("26 en 31. Afirmativa."), no votos individuales por legislador. La Cámara de Representantes sí publica votos individuales desde que implementó votación electrónica (marzo 2025, legislatura 50).

## Fuentes de datos

### DAvotaciones.json (votos individuales)
- URL: `https://documentos.diputados.gub.uy/docs/DAvotaciones.json`
- 71 registros de votaciones electrónicas, ~6,827 votos individuales
- Campos: Sesion, SesionFecha, Votacion (número), Tipo, SiVoto, NoVoto, Lista_Si[], Lista_No[]
- Nombres en formato "Apellido, Nombre" completo
- No incluye nombre del proyecto/asunto votado
- 9 sesiones cubiertas (marzo-julio 2025)

### DAdiarioSesiones.json (índice de diarios)
- URL: `https://documentos.diputados.gub.uy/docs/DAdiarioSesiones.json`
- Índice con URLs a PDFs de diarios de sesión
- Campos: Legislatura, Periodo, Tipo, Sesion, SesionTipo, SesionFecha, Diario, URL

### PDFs de diarios de sesión (contexto de votaciones)
- Contienen el texto completo de la sesión con marcadores `(Se vota)` y resultado
- El nombre del proyecto/asunto votado aparece en el contexto antes de cada `(Se vota)`
- Las votaciones electrónicas son un subconjunto de todas las votaciones en la sesión

## Estrategia de cruce

Las votaciones del JSON se matchean con las del PDF por conteos de votos:
- JSON: `SiVoto=94, NoVoto=1`
- PDF: "Noventa y cuatro votos afirmativos y un voto negativo"
- Si hay ambigüedad, se usa orden secuencial como desempate

## Arquitectura

```
DAvotaciones.json ──────────────────────────┐
                                            ├──→ cargador-votaciones-representantes.ts ──→ DB
DAdiarioSesiones.json ──→ PDFs diarios ─────┘
                          (extraer nombres de proyectos)
```

### Componentes nuevos

1. `src/scraper/votaciones-representantes.ts` — Descarga JSON de votaciones y diarios
2. `src/parser/parser-diario-representantes.ts` — Extrae nombres de proyectos del PDF, matchea con JSON
3. `src/loader/cargador-votaciones-representantes.ts` — Carga sesiones + proyectos + votos individuales
4. `src/seed/legisladores-representantes.ts` — Seed de ~99 diputados desde nombres del JSON

### Modificaciones

- `src/cli.ts` — Agregar comando `representantes`
- `src/pipeline.ts` — Incluir paso de representantes en `all`

## Limitaciones

- Solo legislatura 50 (desde marzo 2025)
- Solo Cámara de Representantes (Senado no tiene datos individuales)
- Las votaciones electrónicas son un subconjunto (las más importantes, no trámites rutinarios)
- Algunos nombres de proyectos pueden quedar genéricos si el cruce falla
