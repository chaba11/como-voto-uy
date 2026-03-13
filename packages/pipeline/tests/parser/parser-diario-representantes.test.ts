import { describe, expect, it } from 'vitest'
import {
  extraerNombreProyecto,
  extraerVotacionesDiario,
  matchearVotaciones,
} from '../../src/parser/parser-diario-representantes.js'
import type { VotacionRepresentantes } from '../../src/scraper/votaciones-representantes.js'

function simplificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

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

  it('extrae formato con total expresado como presentes', () => {
    const texto =
      'Corresponde votar. (Se vota) ' +
      '——Ochenta y cuatro votos afirmativos y ocho votos negativos en noventa y dos presentes: AFIRMATIVA.'

    const votaciones = extraerVotacionesDiario(texto)

    expect(votaciones).toHaveLength(1)
    expect(votaciones[0].afirmativos).toBe(84)
    expect(votaciones[0].negativos).toBe(8)
    expect(votaciones[0].total).toBe(92)
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
  it('rescata proyectos relacionados con un tema aunque no usen sobre o relativo a', () => {
    const nombre = extraerNombreProyecto(
      'Proyecto de ley, relacionado con un factor que es prevenible y tratable: el frenillo lingual corto.',
    )

    expect(simplificar(nombre.tituloPublico)).toContain('frenillo lingual corto')
    expect(['canonico', 'razonable']).toContain(nombre.calidadTitulo)
  })

  it('rescata encabezados fuertes de agenda del Senado', () => {
    const nombre = extraerNombreProyecto(
      '15) LLAMADO A SALA A LA MINISTRA DE DEFENSA NACIONAL, SEÑORA SANDRA LAZO SEÑORA BIANCHI.- Pido la palabra para una cuestión de orden.',
    )

    expect(simplificar(nombre.tituloPublico)).toContain(
      'llamado a sala a la ministra de defensa nacional',
    )
    expect(['razonable', 'canonico']).toContain(nombre.calidadTitulo)
  })

  it('rescata autorizaciones a comisión para sesionar en forma simultánea', () => {
    const nombre = extraerNombreProyecto(
      'AUTORIZACIÓN A LA COMISIÓN DE SALUD PÚBLICA A SESIONAR EN FORMA SIMULTÁNEA CON LA SESIÓN DEL SENADO SEÑORA KRAMER.- Pido la palabra para una moción de orden.',
    )

    expect(simplificar(nombre.tituloPublico)).toContain(
      'autorizacion a la comision de salud publica a sesionar en forma simultanea',
    )
    expect(['canonico', 'razonable']).toContain(nombre.calidadTitulo)
  })

  it('recorta títulos relacionados con dos puntos a su núcleo temático', () => {
    const nombre = extraerNombreProyecto(
      'Proyecto de ley, relacionado con un factor que es prevenible y tratable: el frenillo lingual corto.',
    )

    expect(simplificar(nombre.tituloPublico)).toContain('frenillo lingual corto')
    expect(simplificar(nombre.tituloPublico)).not.toContain('un factor que es prevenible')
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
    expect(resultado[0].tituloPublico).toBe('Medio ambiente')
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

  it('prefiere el contexto con mejor título cuando el conteo se repite', () => {
    const resultado = matchearVotaciones(
      [crearVotacionJson({ Votacion: '1', SiVoto: '90', NoVoto: '0' })],
      [
        {
          afirmativos: 90,
          negativos: 0,
          total: 90,
          resultado: 'afirmativa',
          textoContexto: 'Proyecto de ley. Gracias, señor presidente. Quiero fundamentar mi voto.',
        },
        {
          afirmativos: 90,
          negativos: 0,
          total: 90,
          resultado: 'afirmativa',
          textoContexto:
            'Carpeta N° 1234/2025. Repartido N° 77/2025. Proyecto de ley sobre acceso a medicamentos.',
        },
      ],
    )

    expect(simplificar(resultado[0].tituloPublico)).toContain('acceso a medicamentos')
    expect(simplificar(resultado[0].tituloPublico)).not.toContain('gracias')
  })

  it('usa fallback honesto cuando no hay match en el diario', () => {
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

    expect(simplificar(resultado[0].nombreProyecto)).toContain('asunto sin t')
    expect(simplificar(resultado[0].tituloPublico)).toContain('asunto sin t')
    expect(resultado[0].origenTitulo).toBe('identificador')
    expect(resultado[0].calidadTitulo).toBe('incompleto')
  })
})

describe('extraerNombreProyecto', () => {
  it('extrae y canoniza nombre de proyecto de ley', () => {
    const nombre = extraerNombreProyecto(
      'Se pasa a considerar el proyecto de ley sobre regulación del cannabis medicinal. (Se vota)',
    )

    expect(nombre.nombre).toBe('Regulación del cannabis medicinal')
    expect(nombre.tituloPublico).toBe('Regulación del cannabis medicinal')
    expect(nombre.calidadTitulo).toBe('canonico')
  })

  it('cae a un identificador razonable cuando solo hay carpeta', () => {
    const nombre = extraerNombreProyecto(
      'Se somete a votación. Carpeta N° 1234/2025. (Se vota)',
    )

    expect(nombre.nombre).toBe('Carpeta 1234')
    expect(nombre.tituloPublico).toBe('Carpeta 1234')
    expect(nombre.origenTitulo).toBe('identificador')
    expect(nombre.calidadTitulo).toBe('incompleto')
    expect(nombre.carpeta).toBe('1234')
  })

  it('usa fallback contextual cuando no encuentra una fórmula de proyecto', () => {
    const nombre = extraerNombreProyecto(
      'Texto breve. Se somete a votación la modificación del artículo 23 del código penal. (Se vota)',
    )

    expect(simplificar(nombre.nombre)).toContain('modificacion del articulo 23')
    expect(['razonable', 'incompleto']).toContain(nombre.calidadTitulo)
  })

  it('descarta frases de trámite y cortesía como título', () => {
    const nombre = extraerNombreProyecto(
      'Proyecto de ley sobre sistema nacional de cuidados. Gracias, señor presidente. Solicito que la versión taquigráfica...',
    )

    expect(simplificar(nombre.tituloPublico)).toContain('sistema nacional de cuidados')
    expect(simplificar(nombre.tituloPublico)).not.toContain('gracias')
  })

  it('rescata encabezados de orden del día y asunto relativo a', () => {
    const nombre = extraerNombreProyecto(
      "16.- Operantar XLIII. (Se autoriza el ingreso a aguas jurisdiccionales y al territorio nacional del Buque Polar 'Almirante Maximiano'). " +
        'De acuerdo con lo resuelto por la Cámara, se pasa a considerar el asunto relativo a: ' +
        "\"Operantar XLIII. (Se autoriza el ingreso a aguas jurisdiccionales y al territorio nacional del Buque Polar 'Almirante Maximiano')\". " +
        '(ANTECEDENTES:) Rep. N° 32/025.',
    )

    expect(simplificar(nombre.tituloPublico)).toContain('operantar xliii')
    expect(simplificar(nombre.tituloPublico)).toContain('almirante maximiano')
  })

  it('rescata mociones de pase a comisión cuando no hay encabezado formal', () => {
    const nombre = extraerNombreProyecto(
      'Está claro que vamos a votar la moción presentada con las firmas que tengo aquí en la Mesa, para que esto pase a la Comisión Especial de Asuntos Municipales. Se va a votar.',
    )

    expect(simplificar(nombre.tituloPublico)).toContain(
      'pase a la comision especial de asuntos municipales',
    )
    expect(['canonico', 'razonable', 'incompleto']).toContain(nombre.calidadTitulo)
  })

  it('descarta fórmulas procedimentales cuando mencionan tomar la votación', () => {
    const nombre = extraerNombreProyecto(
      'Proyecto de ley, que el señor presidente tenga a bien tomar la votación de manera electrónica. Está claro que vamos a votar la moción presentada para que esto pase a la Comisión Especial de Asuntos Municipales.',
    )

    expect(simplificar(nombre.tituloPublico)).toContain(
      'pase a la comision especial de asuntos municipales',
    )
    expect(simplificar(nombre.tituloPublico)).not.toContain('tomar la votacion')
  })

  it('aplica un override manual cuando existe para carpeta y repartido', () => {
    const nombre = extraerNombreProyecto(
      'Carpeta N° 999999/2025. Repartido N° 888/2025. Se vota.',
    )

    expect(simplificar(nombre.nombre)).toContain('regimen de transparencia')
    expect(simplificar(nombre.tituloPublico)).toContain('regimen de transparencia')
    expect(nombre.origenTitulo).toBe('override_manual')
  })
})
