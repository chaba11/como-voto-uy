import { describe, it, expect } from 'vitest'
import {
  extraerVotosNominales,
  extraerResultadoAgregado,
  convertirNumeroEscrito,
} from '../../src/parser/extractor-votos.js'

describe('extraerVotosNominales', () => {
  it('extrae votos de texto con formato estándar', () => {
    const texto = `
SEÑORA ASIAÍN.- Voto por la negativa.
SEÑOR BATLLE.- Voto por la negativa.
SEÑOR DOMENECH.- Voto por la afirmativa.
    `
    const votos = extraerVotosNominales(texto)

    expect(votos).toHaveLength(3)
    expect(votos[0]).toEqual({ nombreLegislador: 'ASIAÍN', voto: 'negativo' })
    expect(votos[1]).toEqual({ nombreLegislador: 'BATLLE', voto: 'negativo' })
    expect(votos[2]).toEqual({ nombreLegislador: 'DOMENECH', voto: 'afirmativo' })
  })

  it('extrae votos con apellido compuesto', () => {
    const texto = `
SEÑOR MANINI RÍOS.- Voto por la afirmativa.
SEÑORA DELLA VENTURA.- Voto por la negativa.
SEÑOR DA SILVA.- Voto por la negativa.
    `
    const votos = extraerVotosNominales(texto)

    expect(votos).toHaveLength(3)
    expect(votos[0]).toEqual({ nombreLegislador: 'MANINI RÍOS', voto: 'afirmativo' })
    expect(votos[1]).toEqual({ nombreLegislador: 'DELLA VENTURA', voto: 'negativo' })
    expect(votos[2]).toEqual({ nombreLegislador: 'DA SILVA', voto: 'negativo' })
  })

  it('extrae votos con texto adicional después del voto', () => {
    const texto = `
SEÑORA DELLA VENTURA.- Voto por la negativa. Simplemente quiero aclarar que cuando hice referencia en mi intervención anterior era sobre el proyecto de aditivo que estamos votando.
    `
    const votos = extraerVotosNominales(texto)

    expect(votos).toHaveLength(1)
    expect(votos[0].nombreLegislador).toBe('DELLA VENTURA')
    expect(votos[0].voto).toBe('negativo')
  })

  it('devuelve arreglo vacío si no hay votos', () => {
    const votos = extraerVotosNominales('Texto sin votos nominales.')
    expect(votos).toEqual([])
  })

  it('maneja SEÑORA PRESIDENTE correctamente', () => {
    const texto = `
SEÑORA PRESIDENTE.- Voto por la negativa en cumplimiento del acuerdo.
    `
    const votos = extraerVotosNominales(texto)

    expect(votos).toHaveLength(1)
    expect(votos[0].nombreLegislador).toBe('PRESIDENTE')
    expect(votos[0].voto).toBe('negativo')
  })
})

describe('extraerResultadoAgregado', () => {
  it('extrae resultado con unanimidad', () => {
    const resultado = extraerResultadoAgregado('–19 en 19. Afirmativa. UNANIMIDAD.')

    expect(resultado).toEqual({
      afirmativos: 19,
      total: 19,
      resultado: 'afirmativa',
      unanimidad: true,
    })
  })

  it('extrae resultado sin unanimidad', () => {
    const resultado = extraerResultadoAgregado('–13 en 31. Negativa.')

    expect(resultado).toEqual({
      afirmativos: 13,
      total: 31,
      resultado: 'negativa',
      unanimidad: false,
    })
  })

  it('extrae resultado con guión alternativo (‒)', () => {
    const resultado = extraerResultadoAgregado('‒16 en 19. Afirmativa.')

    expect(resultado).toEqual({
      afirmativos: 16,
      total: 19,
      resultado: 'afirmativa',
      unanimidad: false,
    })
  })

  it('extrae resultado con dos puntos en lugar de punto', () => {
    const resultado = extraerResultadoAgregado('–25 en 25: Afirmativa. UNANIMIDAD.')

    expect(resultado).toEqual({
      afirmativos: 25,
      total: 25,
      resultado: 'afirmativa',
      unanimidad: true,
    })
  })

  it('retorna null si no hay resultado', () => {
    const resultado = extraerResultadoAgregado('Texto sin resultado de votación.')
    expect(resultado).toBeNull()
  })

  it('extrae resultado con espacio antes de Afirmativa', () => {
    const resultado = extraerResultadoAgregado('–25 en 25. Afirmativa. UNANIMIDAD.')
    expect(resultado).not.toBeNull()
    expect(resultado!.afirmativos).toBe(25)
  })
})

describe('convertirNumeroEscrito', () => {
  it('convierte unidades simples', () => {
    expect(convertirNumeroEscrito('uno')).toBe(1)
    expect(convertirNumeroEscrito('cinco')).toBe(5)
    expect(convertirNumeroEscrito('nueve')).toBe(9)
  })

  it('convierte números del 10 al 29', () => {
    expect(convertirNumeroEscrito('diez')).toBe(10)
    expect(convertirNumeroEscrito('quince')).toBe(15)
    expect(convertirNumeroEscrito('veinte')).toBe(20)
    expect(convertirNumeroEscrito('veinticinco')).toBe(25)
  })

  it('convierte decenas', () => {
    expect(convertirNumeroEscrito('treinta')).toBe(30)
    expect(convertirNumeroEscrito('cincuenta')).toBe(50)
    expect(convertirNumeroEscrito('noventa')).toBe(90)
  })

  it('convierte decenas compuestas', () => {
    expect(convertirNumeroEscrito('sesenta y dos')).toBe(62)
    expect(convertirNumeroEscrito('sesenta y tres')).toBe(63)
    expect(convertirNumeroEscrito('treinta y uno')).toBe(31)
    expect(convertirNumeroEscrito('cuarenta y cinco')).toBe(45)
  })

  it('retorna null para texto no numérico', () => {
    expect(convertirNumeroEscrito('hola')).toBeNull()
    expect(convertirNumeroEscrito('')).toBeNull()
  })

  it('es case-insensitive', () => {
    expect(convertirNumeroEscrito('Sesenta y dos')).toBe(62)
    expect(convertirNumeroEscrito('VEINTE')).toBe(20)
  })
})
