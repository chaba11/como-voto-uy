import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectarCharset, extraerUrlDescarga } from '../../src/scraper/descargador.js'

const fixturePaginaDoc = readFileSync(
  join(__dirname, '../fixtures/pagina-documento.html'),
  'utf-8',
)

describe('extraerUrlDescarga', () => {
  it('extrae la URL de infolegislativa de la página del documento', () => {
    const url = extraerUrlDescarga(fixturePaginaDoc)

    expect(url).toBeTruthy()
    expect(url).toContain('infolegislativa.parlamento.gub.uy/temporales/')
    expect(url).toMatch(/\.html$/)
  })

  it('retorna null si no encuentra la URL', () => {
    const url = extraerUrlDescarga('<html><body>Sin enlace</body></html>')
    expect(url).toBeNull()
  })
})

describe('detectarCharset', () => {
  it('detecta charset utf-8', () => {
    const html = '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">'
    expect(detectarCharset(html)).toBe('utf-8')
  })

  it('detecta charset iso-8859-1', () => {
    const html = '<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">'
    expect(detectarCharset(html)).toBe('iso-8859-1')
  })

  it('detecta charset con meta charset directo', () => {
    const html = '<meta charset="utf-8">'
    expect(detectarCharset(html)).toBe('utf-8')
  })

  it('retorna utf-8 por defecto si no se encuentra charset', () => {
    const html = '<html><body>Sin charset</body></html>'
    expect(detectarCharset(html)).toBe('utf-8')
  })
})
