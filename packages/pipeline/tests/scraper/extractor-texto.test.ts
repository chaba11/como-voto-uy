import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extraerTextoDeHtml } from '../../src/scraper/extractor-texto.js'

const fixtureTaquigrafica = readFileSync(
  join(__dirname, '../fixtures/taquigrafica-simple.html'),
  'utf-8',
)

describe('extraerTextoDeHtml', () => {
  it('extrae texto sin tags HTML', () => {
    const texto = extraerTextoDeHtml(fixtureTaquigrafica)

    expect(texto).not.toContain('<p')
    expect(texto).not.toContain('<span')
    expect(texto).not.toContain('<td')
    expect(texto).not.toContain('<table')
  })

  it('preserva el contenido textual relevante', () => {
    const texto = extraerTextoDeHtml(fixtureTaquigrafica)

    expect(texto).toContain('REPÚBLICA ORIENTAL DEL URUGUAY')
    expect(texto).toContain('DIARIO DE SESIONES')
    expect(texto).toContain('CÁMARA DE SENADORES')
  })

  it('no contiene bloques de estilo', () => {
    const texto = extraerTextoDeHtml(fixtureTaquigrafica)

    expect(texto).not.toContain('font-style')
    expect(texto).not.toContain('font-weight')
    expect(texto).not.toContain('text-align')
  })

  it('normaliza espacios en blanco múltiples', () => {
    const texto = extraerTextoDeHtml(fixtureTaquigrafica)

    // No triple newlines
    expect(texto).not.toMatch(/\n{3,}/)
    // No lines with only whitespace
    const lineas = texto.split('\n')
    for (const linea of lineas) {
      if (linea.length > 0) {
        expect(linea).not.toMatch(/^[ \t]+$/)
      }
    }
  })

  it('decodifica entidades HTML', () => {
    const html = '<p>p&aacute;gina &amp; sesi&oacute;n</p>'
    const texto = extraerTextoDeHtml(html)

    expect(texto).toContain('página')
    expect(texto).toContain('&')
    expect(texto).toContain('sesión')
  })
})
