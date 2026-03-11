import { describe, expect, it } from 'vitest'
import {
  buscarLegislador,
  crearClavesNombre,
  normalizarNombre,
  sinAcentos,
} from '../../src/parser/normalizador-nombres.js'

describe('normalizarNombre', () => {
  it('convierte a mayúsculas', () => {
    expect(normalizarNombre('García')).toBe('GARCÍA')
  })

  it('elimina espacios extra', () => {
    expect(normalizarNombre('  MANINI   RÍOS  ')).toBe('MANINI RÍOS')
  })

  it('remueve tratamientos frecuentes', () => {
    expect(normalizarNombre('Sr. García')).toBe('GARCÍA')
  })
})

describe('sinAcentos', () => {
  it('elimina acentos', () => {
    expect(sinAcentos('ASIAÍN')).toBe('ASIAIN')
    expect(sinAcentos('GARCÍA')).toBe('GARCIA')
    expect(sinAcentos('MUÑOZ')).toBe('MUNOZ')
  })
})

describe('crearClavesNombre', () => {
  it('genera claves para formas con coma e iniciales', () => {
    const claves = crearClavesNombre('Abdala, Pablo D.')

    expect(claves).toContain('ABDALA PABLO D')
    expect(claves).toContain('PABLO D ABDALA')
    expect(claves).toContain('ABDALA PABLO')
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
    { id: 7, nombre: 'Abdala, Pablo D.' },
  ]

  it('encuentra por apellido exacto', () => {
    expect(buscarLegislador('BERGARA', legisladores)).toBe(3)
  })

  it('encuentra por apellido compuesto', () => {
    expect(buscarLegislador('MANINI RIOS', legisladores)).toBe(2)
  })

  it('encuentra nombres con coma e iniciales', () => {
    expect(buscarLegislador('Pablo Abdala', legisladores)).toBe(7)
  })

  it('encuentra por nombre parcial sin acentos', () => {
    expect(buscarLegislador('DA SILVA', legisladores)).toBe(5)
  })

  it('retorna null si no encuentra', () => {
    expect(buscarLegislador('INEXISTENTE', legisladores)).toBeNull()
  })
})
