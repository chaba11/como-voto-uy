import { describe, it, expect } from 'vitest'
import {
  extraerVotacionesDiario,
  matchearVotaciones,
  extraerNombreProyecto,
} from '../../src/parser/parser-diario-representantes.js'
import type { VotacionRepresentantes } from '../../src/scraper/votaciones-representantes.js'

describe('extraerVotacionesDiario', () => {
  it('extrae formato "N votos afirmativos y M negativos en T"', () => {
    const texto =
      'Se pasa a considerar el proyecto de ley sobre regulación ambiental. ' +
      '(Se vota) ' +
      '——Noventa y cuatro votos afirmativos y un voto negativo en noventa y cinco: AFIRMATIVA.'

    const votaciones = extraerVotacionesDiario(texto)

    expect(votaciones).toHaveLength(1)
    expect(votaciones[0].afirmativos).toBe(94)
    expect(votaciones[0].negativos).toBe(1)
    expect(votaciones[0].total).toBe(95)
    expect(votaciones[0].resultado).toBe('afirmativa')
  })

  it('extrae formato "N en M: RESULTADO"', () => {
    const texto =
      'Corresponde votar el proyecto de resolución sobre transporte público. ' +
      '(Se vota) ' +
      '——Ochenta en ochenta y uno: AFIRMATIVA.'

    const votaciones = extraerVotacionesDiario(texto)

    expect(votaciones).toHaveLength(1)
    expect(votaciones[0].afirmativos).toBe(80)
    expect(votaciones[0].negativos).toBe(1)
    expect(votaciones[0].total).toBe(81)
    expect(votaciones[0].resultado).toBe('afirmativa')
  })

  it('extrae formato "N por la afirmativa: AFIRMATIVA"', () => {
    const texto =
      'Se somete a votación el presupuesto nacional. ' +
      '(Se vota) ' +
      '——Sesenta por la afirmativa: AFIRMATIVA. Unanimidad.'

    const votaciones = extraerVotacionesDiario(texto)

    expect(votaciones).toHaveLength(1)
    expect(votaciones[0].afirmativos).toBe(60)
    expect(votaciones[0].negativos).toBe(0)
    expect(votaciones[0].total).toBe(60)
    expect(votaciones[0].resultado).toBe('afirmativa')
  })

  it('extrae múltiples votaciones del mismo texto', () => {
    const texto =
      'Primer proyecto sobre educación. (Se vota) ' +
      '——Cincuenta en noventa: AFIRMATIVA. ' +
      'Ahora pasamos al segundo proyecto sobre salud pública. (Se vota) ' +
      '——Treinta y cinco votos afirmativos y cuarenta votos negativos en setenta y cinco: NEGATIVA.'

    const votaciones = extraerVotacionesDiario(texto)

    expect(votaciones).toHaveLength(2)
    expect(votaciones[0].afirmativos).toBe(50)
    expect(votaciones[0].negativos).toBe(40)
    expect(votaciones[0].total).toBe(90)
    expect(votaciones[1].afirmativos).toBe(35)
    expect(votaciones[1].negativos).toBe(40)
    expect(votaciones[1].total).toBe(75)
    expect(votaciones[1].resultado).toBe('negativa')
  })

  it('captura texto de contexto previo a la votación', () => {
    const contexto = 'Se considera el proyecto de ley de presupuesto quinquenal. '
    const texto =
      contexto +
      '(Se vota) ' +
      '——Veinte en veinticinco: AFIRMATIVA.'

    const votaciones = extraerVotacionesDiario(texto)

    expect(votaciones).toHaveLength(1)
    expect(votaciones[0].textoContexto).toContain('proyecto de ley de presupuesto quinquenal')
  })

  it('devuelve arreglo vacío si no hay votaciones', () => {
    const texto = 'Texto de sesión sin ninguna votación registrada.'
    const votaciones = extraerVotacionesDiario(texto)
    expect(votaciones).toEqual([])
  })

  it('maneja resultado NEGATIVA correctamente', () => {
    const texto =
      'Votación del proyecto. (Se vota) ' +
      '——Treinta en ochenta: NEGATIVA.'

    const votaciones = extraerVotacionesDiario(texto)

    expect(votaciones).toHaveLength(1)
    expect(votaciones[0].afirmativos).toBe(30)
    expect(votaciones[0].negativos).toBe(50)
    expect(votaciones[0].total).toBe(80)
    expect(votaciones[0].resultado).toBe('negativa')
  })

  it('no duplica votaciones que matchean patrón 1 y patrón 2', () => {
    const texto =
      'Proyecto importante. (Se vota) ' +
      '——Sesenta y dos votos afirmativos y tres votos negativos en sesenta y cinco: AFIRMATIVA.'

    const votaciones = extraerVotacionesDiario(texto)

    // Solo debe aparecer una vez (patrón 1), no duplicado por patrón 2
    expect(votaciones).toHaveLength(1)
    expect(votaciones[0].afirmativos).toBe(62)
    expect(votaciones[0].negativos).toBe(3)
    expect(votaciones[0].total).toBe(65)
  })
})

describe('matchearVotaciones', () => {
  const crearVotacionJson = (
    overrides: Partial<VotacionRepresentantes> = {},
  ): VotacionRepresentantes => ({
    Sesion: 1,
    SesionFecha: '2025-06-15',
    Votacion: '1',
    Tipo: 'Ordinaria',
    SiVoto: '80',
    NoVoto: '1',
    Lista_Si: ['LEGISLADOR A', 'LEGISLADOR B'],
    Lista_No: ['LEGISLADOR C'],
    ...overrides,
  })

  it('matchea por conteo exacto de votos', () => {
    const votacionesJson = [
      crearVotacionJson({ Votacion: '1', SiVoto: '80', NoVoto: '1' }),
    ]

    const votacionesDiario = [
      {
        afirmativos: 80,
        negativos: 1,
        total: 81,
        resultado: 'afirmativa' as const,
        textoContexto: 'Se aprueba el proyecto de ley sobre medio ambiente.',
      },
    ]

    const resultado = matchearVotaciones(votacionesJson, votacionesDiario)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].siVoto).toBe(80)
    expect(resultado[0].noVoto).toBe(1)
    expect(resultado[0].nombreProyecto).toContain('proyecto de ley sobre medio ambiente')
  })

  it('usa orden secuencial como desempate cuando hay múltiples matches', () => {
    const votacionesJson = [
      crearVotacionJson({ Votacion: '1', SiVoto: '90', NoVoto: '0' }),
      crearVotacionJson({ Votacion: '2', SiVoto: '90', NoVoto: '0' }),
    ]

    const votacionesDiario = [
      {
        afirmativos: 90,
        negativos: 0,
        total: 90,
        resultado: 'afirmativa' as const,
        textoContexto: 'Primer proyecto de ley sobre educación.',
      },
      {
        afirmativos: 90,
        negativos: 0,
        total: 90,
        resultado: 'afirmativa' as const,
        textoContexto: 'Segundo proyecto de ley sobre salud.',
      },
    ]

    const resultado = matchearVotaciones(votacionesJson, votacionesDiario)

    expect(resultado).toHaveLength(2)
    expect(resultado[0].nombreProyecto).toContain('educación')
    expect(resultado[1].nombreProyecto).toContain('salud')
  })

  it('usa nombre genérico cuando no hay match en el diario', () => {
    const votacionesJson = [
      crearVotacionJson({ Votacion: '3', SiVoto: '50', NoVoto: '30' }),
    ]

    const votacionesDiario = [
      {
        afirmativos: 70,
        negativos: 10,
        total: 80,
        resultado: 'afirmativa' as const,
        textoContexto: 'Proyecto que no matchea.',
      },
    ]

    const resultado = matchearVotaciones(votacionesJson, votacionesDiario)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].nombreProyecto).toBe('Votación 3')
  })

  it('no reutiliza una entrada del diario ya matcheada', () => {
    const votacionesJson = [
      crearVotacionJson({ Votacion: '1', SiVoto: '80', NoVoto: '5' }),
      crearVotacionJson({ Votacion: '2', SiVoto: '80', NoVoto: '5' }),
    ]

    const votacionesDiario = [
      {
        afirmativos: 80,
        negativos: 5,
        total: 85,
        resultado: 'afirmativa' as const,
        textoContexto: 'Único proyecto de ley disponible.',
      },
    ]

    const resultado = matchearVotaciones(votacionesJson, votacionesDiario)

    expect(resultado).toHaveLength(2)
    expect(resultado[0].nombreProyecto).toContain('proyecto de ley disponible')
    // Segunda votación no encuentra match porque la única entrada ya fue usada
    expect(resultado[1].nombreProyecto).toBe('Votación 2')
  })

  it('preserva datos del JSON en el resultado', () => {
    const votacionesJson = [
      crearVotacionJson({
        Sesion: 42,
        SesionFecha: '2025-08-20',
        Votacion: '7',
        SiVoto: '60',
        NoVoto: '0',
        Lista_Si: ['PÉREZ', 'GÓMEZ'],
        Lista_No: [],
      }),
    ]

    const votacionesDiario = [
      {
        afirmativos: 60,
        negativos: 0,
        total: 60,
        resultado: 'afirmativa' as const,
        textoContexto: 'Carpeta N° 1234/2025 sobre transporte.',
      },
    ]

    const resultado = matchearVotaciones(votacionesJson, votacionesDiario)

    expect(resultado[0].sesion).toBe(42)
    expect(resultado[0].fecha).toBe('2025-08-20')
    expect(resultado[0].votacionNumero).toBe('7')
    expect(resultado[0].listaSi).toEqual(['PÉREZ', 'GÓMEZ'])
    expect(resultado[0].listaNo).toEqual([])
  })
})

describe('extraerNombreProyecto', () => {
  it('extrae nombre de "proyecto de ley"', () => {
    const contexto =
      'Se pasa a considerar el proyecto de ley sobre regulación del cannabis medicinal. ' +
      '(Se vota)'

    const nombre = extraerNombreProyecto(contexto)

    expect(nombre).toContain('proyecto de ley sobre regulación del cannabis medicinal')
  })

  it('extrae nombre de "proyecto de resolución"', () => {
    const contexto =
      'Corresponde votar el proyecto de resolución relativo a la declaración de interés nacional. ' +
      '(Se vota)'

    const nombre = extraerNombreProyecto(contexto)

    expect(nombre).toContain('proyecto de resolución')
  })

  it('extrae Carpeta cuando no hay proyecto de ley', () => {
    const contexto =
      'Se somete a votación. Carpeta N° 1234/2025. (Se vota)'

    const nombre = extraerNombreProyecto(contexto)

    expect(nombre).toContain('Carpeta N° 1234/2025')
  })

  it('extrae Repartido cuando no hay proyecto de ley', () => {
    const contexto =
      'Votación del Repartido N° 567. (Se vota)'

    const nombre = extraerNombreProyecto(contexto)

    expect(nombre).toContain('Repartido N° 567')
  })

  it('usa fallback de última oración significativa', () => {
    const contexto =
      'Texto breve. Se somete a votación la modificación del artículo 23 del código penal. (Se vota)'

    const nombre = extraerNombreProyecto(contexto)

    expect(nombre.length).toBeGreaterThan(10)
    expect(nombre).toContain('modificación del artículo 23')
  })

  it('trunca nombres demasiado largos a 200 caracteres', () => {
    const textoLargo = 'proyecto de ley ' + 'sobre regulación '.repeat(20) + '.'
    const contexto = textoLargo

    const nombre = extraerNombreProyecto(contexto)

    expect(nombre.length).toBeLessThanOrEqual(203) // 200 + "..."
  })

  it('devuelve "Votación sin nombre" cuando no hay contexto útil', () => {
    const contexto = 'ab. cd.'

    const nombre = extraerNombreProyecto(contexto)

    expect(nombre).toBe('Votación sin nombre')
  })

  it('usa último match cuando hay múltiples proyectos de ley en el contexto', () => {
    const contexto =
      'Se aprobó el proyecto de ley sobre educación. ' +
      'Ahora consideramos el proyecto de ley sobre reforma tributaria. ' +
      '(Se vota)'

    const nombre = extraerNombreProyecto(contexto)

    expect(nombre).toContain('reforma tributaria')
  })
})
