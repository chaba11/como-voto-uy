import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extraerTextoDeHtml } from '../../src/scraper/extractor-texto.js'
import { parsearTaquigrafica } from '../../src/parser/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rutaFixture = resolve(__dirname, '../fixtures/taquigrafica-nominal.html')

describe('regresión: parseo de taquigráfica nominal', () => {
  const html = readFileSync(rutaFixture, 'utf-8')
  const texto = extraerTextoDeHtml(html)
  const resultado = parsearTaquigrafica(texto)

  it('detecta al menos una votación nominal', () => {
    const nominales = resultado.votaciones.filter((v) => v.tipo === 'nominal')
    expect(nominales.length).toBeGreaterThanOrEqual(1)
  })

  it('detecta votaciones agregadas', () => {
    const agregadas = resultado.votaciones.filter((v) => v.tipo === 'agregada')
    expect(agregadas.length).toBeGreaterThanOrEqual(1)
  })

  it('extrae votos individuales en la votación nominal', () => {
    const nominales = resultado.votaciones.filter((v) => v.tipo === 'nominal')
    expect(nominales.length).toBeGreaterThanOrEqual(1)

    const primeraVotacionNominal = nominales[0]
    expect(primeraVotacionNominal.votos.length).toBeGreaterThanOrEqual(5)
  })

  it('encuentra legisladores conocidos en los votos nominales', () => {
    const nominales = resultado.votaciones.filter((v) => v.tipo === 'nominal')
    const todosLosVotos = nominales.flatMap((v) => v.votos)
    const nombres = todosLosVotos.map((v) => v.nombreLegislador)

    // Estos legisladores deben aparecer en la taquigráfica nominal del fixture
    expect(nombres).toContain('ASIAÍN')
    expect(nombres).toContain('DOMENECH')
    expect(nombres).toContain('MANINI RÍOS')
  })

  it('los votos tienen valores válidos', () => {
    const nominales = resultado.votaciones.filter((v) => v.tipo === 'nominal')
    const todosLosVotos = nominales.flatMap((v) => v.votos)

    for (const voto of todosLosVotos) {
      expect(['afirmativo', 'negativo']).toContain(voto.voto)
      expect(voto.nombreLegislador.length).toBeGreaterThan(0)
    }
  })

  it('detecta asistentes', () => {
    expect(resultado.asistentes.length).toBeGreaterThanOrEqual(1)
  })

  it('detecta ausentes', () => {
    expect(resultado.ausentes.length).toBeGreaterThanOrEqual(1)
  })

  it('el resultado coincide con snapshot de propiedades clave', () => {
    const resumen = {
      totalVotaciones: resultado.votaciones.length,
      votacionesNominales: resultado.votaciones.filter((v) => v.tipo === 'nominal').length,
      votacionesAgregadas: resultado.votaciones.filter((v) => v.tipo === 'agregada').length,
      totalVotosNominales: resultado.votaciones
        .filter((v) => v.tipo === 'nominal')
        .reduce((acc, v) => acc + v.votos.length, 0),
      cantidadAsistentes: resultado.asistentes.length,
      cantidadAusentes: resultado.ausentes.length,
    }

    expect(resumen).toMatchSnapshot()
  })
})
