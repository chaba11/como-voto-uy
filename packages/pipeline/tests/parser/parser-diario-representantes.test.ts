import { describe, expect, it } from 'vitest'
import {
  extraerNombreProyecto,
  extraerVotacionesDiario,
  matchearVotaciones,
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

  it('matchea por conteo exacto de votos y canoniza el nombre', () => {
    const resultado = matchearVotaciones(
      [crearVotacionJson({ Votacion: '1', SiVoto: '80', NoVoto: '1' })],
      [
        {
          afirmativos: 80,
          negativos: 1,
          total: 81,
          resultado: 'afirmativa',
          textoContexto: 'Se aprueba el proyecto de ley sobre medio ambiente.',
        },
      ],
    )

    expect(resultado).toHaveLength(1)
    expect(resultado[0].nombreProyecto).toBe('Medio ambiente')
    expect(resultado[0].calidadTitulo).toBe('canonico')
  })

  it('usa orden secuencial como desempate cuando hay múltiples matches', () => {
    const resultado = matchearVotaciones(
      [
        crearVotacionJson({ Votacion: '1', SiVoto: '90', NoVoto: '0' }),
        crearVotacionJson({ Votacion: '2', SiVoto: '90', NoVoto: '0' }),
      ],
      [
        {
          afirmativos: 90,
          negativos: 0,
          total: 90,
          resultado: 'afirmativa',
          textoContexto: 'Primer proyecto de ley sobre educación.',
        },
        {
          afirmativos: 90,
          negativos: 0,
          total: 90,
          resultado: 'afirmativa',
          textoContexto: 'Segundo proyecto de ley sobre salud.',
        },
      ],
    )

    expect(resultado[0].nombreProyecto).toBe('Educación')
    expect(resultado[1].nombreProyecto).toBe('Salud')
  })

  it('usa fallback incompleto cuando no hay match en el diario', () => {
    const resultado = matchearVotaciones(
      [crearVotacionJson({ Votacion: '3', SiVoto: '50', NoVoto: '30' })],
      [
        {
          afirmativos: 70,
          negativos: 10,
          total: 80,
          resultado: 'afirmativa',
          textoContexto: 'Proyecto que no matchea.',
        },
      ],
    )

    expect(resultado[0].nombreProyecto).toBe('Asunto de sesión 1 votación 3')
    expect(resultado[0].calidadTitulo).toBe('incompleto')
  })
})

describe('extraerNombreProyecto', () => {
  it('extrae y canoniza nombre de proyecto de ley', () => {
    const nombre = extraerNombreProyecto(
      'Se pasa a considerar el proyecto de ley sobre regulación del cannabis medicinal. (Se vota)',
    )

    expect(nombre.nombre).toBe('Regulación del cannabis medicinal')
    expect(nombre.calidadTitulo).toBe('canonico')
  })

  it('cae a un identificador razonable cuando solo hay carpeta', () => {
    const nombre = extraerNombreProyecto(
      'Se somete a votación. Carpeta N° 1234/2025. (Se vota)',
    )

    expect(nombre.nombre).toBe('Carpeta 1234')
    expect(nombre.calidadTitulo).toBe('incompleto')
    expect(nombre.carpeta).toBe('1234')
  })

  it('usa fallback contextual cuando no encuentra una fórmula de proyecto', () => {
    const nombre = extraerNombreProyecto(
      'Texto breve. Se somete a votación la modificación del artículo 23 del código penal. (Se vota)',
    )

    expect(nombre.nombre).toContain('Modificación del artículo 23')
    expect(['razonable', 'incompleto']).toContain(nombre.calidadTitulo)
  })
})
