import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { detectarVotaciones } from '../../src/parser/detector-votacion.js'

function leerFixture(nombre: string): string {
  const ruta = join(__dirname, '..', 'fixtures', nombre)
  const html = readFileSync(ruta, 'utf-8')
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#9;/g, '\t')
    .replace(/&[a-z]+;/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('detectarVotaciones', () => {
  it('detecta votaciones nominales en taquigráfica nominal', () => {
    const texto = leerFixture('taquigrafica-nominal.html')
    const secciones = detectarVotaciones(texto)

    const nominales = secciones.filter((s) => s.tipo === 'nominal')
    expect(nominales.length).toBeGreaterThanOrEqual(1)
    expect(nominales[0].texto).toContain('Voto por la')
  })

  it('detecta votaciones agregadas en taquigráfica simple', () => {
    const texto = leerFixture('taquigrafica-simple.html')
    const secciones = detectarVotaciones(texto)

    const agregadas = secciones.filter((s) => s.tipo === 'agregada')
    expect(agregadas.length).toBeGreaterThanOrEqual(1)
    expect(agregadas[0].texto).toMatch(/\d+\s+en\s+\d+/)
  })

  it('detecta múltiples votaciones agregadas en taquigráfica nominal', () => {
    const texto = leerFixture('taquigrafica-nominal.html')
    const secciones = detectarVotaciones(texto)

    const agregadas = secciones.filter((s) => s.tipo === 'agregada')
    expect(agregadas.length).toBeGreaterThan(5)
  })

  it('devuelve arreglo vacío para texto sin votaciones', () => {
    expect(detectarVotaciones('Este es un texto sin votaciones.')).toEqual([])
  })

  it('devuelve arreglo vacío para texto vacío', () => {
    expect(detectarVotaciones('')).toEqual([])
  })

  it('detecta votación agregada con texto hardcoded', () => {
    const texto = `
      SEÑORA PRESIDENTA.- Se va a votar.
      (Se vota).
      –19 en 19. Afirmativa. UNANIMIDAD.
    `
    const secciones = detectarVotaciones(texto)
    expect(secciones).toHaveLength(1)
    expect(secciones[0].tipo).toBe('agregada')
  })

  it('conserva contexto fuerte previo en votaciones agregadas del senado', () => {
    const texto = `
      SEÑOR SECRETARIO.- «Mocionamos para que se declare urgente y se considere de inmediato la carpeta n.º 472/2025:
      proyecto de ley por el que se faculta al Ministerio de Trabajo y Seguridad Social a extender por razones de interés general
      el subsidio por desempleo de los trabajadores dependientes de la empresa Rondatel S. A.».
      SEÑORA PRESIDENTA.- Se va a votar.
      (Se vota).
      –19 en 19. Afirmativa. UNANIMIDAD.
    `
    const secciones = detectarVotaciones(texto)
    expect(secciones).toHaveLength(1)
    expect(secciones[0].texto).toContain('proyecto de ley por el que se faculta')
    expect(secciones[0].texto).toContain('empresa Rondatel S. A.')
  })

  it('detecta votación nominal con texto hardcoded', () => {
    const texto = `
      SEÑORA PRESIDENTE.- En consecuencia, vamos a tomar la votación nominal.
      Tómese la votación nominal del aditivo.
      SEÑORA ASIAÍN.- Voto por la negativa.
      SEÑOR BATLLE.- Voto por la negativa.
      SEÑOR DOMENECH.- Voto por la afirmativa.
      SEÑORA PRESIDENTE.- Voto por la negativa.
    `
    const secciones = detectarVotaciones(texto)
    const nominales = secciones.filter((s) => s.tipo === 'nominal')
    expect(nominales.length).toBeGreaterThanOrEqual(1)
  })
})
