import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parsearListadoHtml } from '../../src/scraper/listado.js'

const fixtureHtml = readFileSync(
  join(__dirname, '../fixtures/listado-senado-leg49.html'),
  'utf-8',
)

describe('parsearListadoHtml', () => {
  it('extrae todas las entradas de la tabla', () => {
    const entradas = parsearListadoHtml(fixtureHtml)
    expect(entradas.length).toBe(40)
  })

  it('extrae correctamente los campos de la primera entrada', () => {
    const entradas = parsearListadoHtml(fixtureHtml)
    const primera = entradas[0]

    expect(primera.sesionNumero).toBe(31)
    expect(primera.diarioNumero).toBe(31)
    expect(primera.resumen).toBeTruthy()
    expect(primera.urlDocumentoPagina).toContain('6845')
  })

  it('convierte fecha de DD-MM-YYYY a YYYY-MM-DD', () => {
    const entradas = parsearListadoHtml(fixtureHtml)
    const primera = entradas[0]

    // 05-02-2025 -> 2025-02-05
    expect(primera.fecha).toBe('2025-02-05')
  })

  it('prefiere links SSN (HTML) sobre IMG (PDF) cuando están disponibles', () => {
    const entradas = parsearListadoHtml(fixtureHtml)
    const primera = entradas[0]

    expect(primera.tipoDocumento).toBe('html')
    expect(primera.urlDocumentoPagina).toContain('/SSN')
  })

  it('extrae la fecha correcta para la segunda entrada', () => {
    const entradas = parsearListadoHtml(fixtureHtml)
    const segunda = entradas[1]

    // 17-12-2024 -> 2024-12-17
    expect(segunda.fecha).toBe('2024-12-17')
    expect(segunda.sesionNumero).toBe(30)
  })

  it('las URLs de documento son absolutas', () => {
    const entradas = parsearListadoHtml(fixtureHtml)
    for (const entrada of entradas) {
      expect(entrada.urlDocumentoPagina).toMatch(/^https?:\/\//)
    }
  })
})
