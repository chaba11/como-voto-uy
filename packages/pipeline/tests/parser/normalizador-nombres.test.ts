import { describe, it, expect } from 'vitest'
import {
  normalizarNombre,
  sinAcentos,
  buscarLegislador,
} from '../../src/parser/normalizador-nombres.js'

describe('normalizarNombre', () => {
  it('convierte a mayúsculas', () => {
    expect(normalizarNombre('García')).toBe('GARCÍA')
  })

  it('elimina espacios extra', () => {
    expect(normalizarNombre('  MANINI   RÍOS  ')).toBe('MANINI RÍOS')
  })

  it('mantiene acentos', () => {
    expect(normalizarNombre('asiaín')).toBe('ASIAÍN')
  })
})

describe('sinAcentos', () => {
  it('elimina acentos', () => {
    expect(sinAcentos('ASIAÍN')).toBe('ASIAIN')
    expect(sinAcentos('GARCÍA')).toBe('GARCIA')
    expect(sinAcentos('RODRÍGUEZ')).toBe('RODRIGUEZ')
  })

  it('elimina ñ normalizada', () => {
    // La ñ no tiene forma descompuesta estándar, se mantiene
    expect(sinAcentos('MUÑOZ')).toBe('MUNOZ')
  })

  it('no modifica texto sin acentos', () => {
    expect(sinAcentos('BATLLE')).toBe('BATLLE')
  })
})

describe('buscarLegislador', () => {
  const legisladores = [
    { id: 1, nombre: 'Beatriz Argimón' },
    { id: 2, nombre: 'Guido Manini Ríos' },
    { id: 3, nombre: 'Mario Bergara' },
    { id: 4, nombre: 'Amanda Della Ventura' },
    { id: 5, nombre: 'Sebastián Da Silva' },
    { id: 6, nombre: 'Carmen Asiaín' },
  ]

  it('encuentra por apellido exacto', () => {
    expect(buscarLegislador('BERGARA', legisladores)).toBe(3)
  })

  it('encuentra por apellido compuesto', () => {
    expect(buscarLegislador('MANINI RÍOS', legisladores)).toBe(2)
  })

  it('encuentra por apellido compuesto sin acentos', () => {
    expect(buscarLegislador('MANINI RIOS', legisladores)).toBe(2)
  })

  it('encuentra por apellido simple contenido en nombre completo', () => {
    expect(buscarLegislador('DELLA VENTURA', legisladores)).toBe(4)
  })

  it('encuentra por nombre parcial', () => {
    expect(buscarLegislador('DA SILVA', legisladores)).toBe(5)
  })

  it('encuentra por apellido con acentos', () => {
    expect(buscarLegislador('ASIAÍN', legisladores)).toBe(6)
  })

  it('encuentra sin importar case', () => {
    expect(buscarLegislador('bergara', legisladores)).toBe(3)
  })

  it('retorna null si no encuentra', () => {
    expect(buscarLegislador('INEXISTENTE', legisladores)).toBeNull()
  })
})
