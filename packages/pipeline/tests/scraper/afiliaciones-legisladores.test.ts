import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchConReintentos } from '../../src/utils/http.js'

vi.mock('../../src/utils/http.js', () => ({
  fetchConReintentos: vi.fn(),
}))

const fetchMock = fetchConReintentos as ReturnType<typeof vi.fn>

const {
  URL_NOMINA_REPRESENTANTES_ACTUAL,
  extraerAsistenciasSenadoDesdeJson,
  extraerBiografiaLegisladorDesdeHtml,
  extraerNominaRepresentantesDesdeCsv,
  extraerPadronRepresentantesDesdeTexto,
  obtenerAsistenciasSenadoPorLegislatura,
  obtenerBiografiasParlamento,
} = await import('../../src/scraper/afiliaciones-legisladores.js')

function crearRespuestaJson(datos: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(datos),
    text: () => Promise.resolve(JSON.stringify(datos)),
  } as Response
}

function crearRespuestaTexto(texto: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: () => Promise.resolve(texto),
  } as Response
}

describe('afiliaciones legisladores scraper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parsea la nómina actual de Diputados y extrae nombre + partido', () => {
    const csv = [
      'Nombre,Genero,Edad,PartidoPolitico,Departamento,HojaVotacion,Correo',
      '"Abdala, Pablo",M,48,Partido Nacional,Montevideo,40,pablo@example.com',
      '"Caggiani, Daniel",M,41,Frente Amplio,Montevideo,609,dani@example.com',
    ].join('\n')

    const registros = extraerNominaRepresentantesDesdeCsv(
      csv,
      'titular',
      URL_NOMINA_REPRESENTANTES_ACTUAL,
    )

    expect(registros).toHaveLength(2)
    expect(registros[0]).toMatchObject({
      nombre: 'Abdala, Pablo',
      siglaPartido: 'PN',
      camara: 'representantes',
      legislatura: 50,
      metodo: 'dataset',
    })
    expect(registros[1].siglaPartido).toBe('FA')
  })

  it('parsea el padrón PDF por partido', () => {
    const texto = `
      Frente Amplio
      Caggiani, Daniel
      Ferreira, Ana
      Partido Nacional
      Abdala, Pablo
      Da Silva, Sebastián
    `

    const registros = extraerPadronRepresentantesDesdeTexto(texto)

    expect(registros).toEqual([
      { nombre: 'Caggiani, Daniel', siglaPartido: 'FA' },
      { nombre: 'Ferreira, Ana', siglaPartido: 'FA' },
      { nombre: 'Abdala, Pablo', siglaPartido: 'PN' },
      { nombre: 'Da Silva, Sebastián', siglaPartido: 'PN' },
    ])
  })

  it('parsea asistencias del Senado y extrae nombres por legislatura', () => {
    const registros = extraerAsistenciasSenadoDesdeJson(
      [
        { Nombre: 'Bianchi, Graciela' },
        { Nombre: 'Bianchi, Graciela' },
        { Nombre: 'Andrade, Oscar' },
      ],
      49,
    )

    expect(registros).toHaveLength(2)
    expect(registros[0]).toMatchObject({
      camara: 'senado',
      legislatura: 49,
      metodo: 'asistencia',
    })
  })

  it('parsea una biografía oficial y recupera partido y legislaturas', () => {
    const html = `
      <html>
        <head><title>Bianchi, Graciela | Biografías</title></head>
        <body>
          <h1>Bianchi, Graciela</h1>
          <div>Senadora. Lema: Partido Nacional.</div>
          <div>Legislatura 49</div>
          <div>Legislatura 50</div>
        </body>
      </html>
    `

    const biografia = extraerBiografiaLegisladorDesdeHtml(html)

    expect(biografia).toEqual({
      nombre: 'Bianchi, Graciela',
      siglaPartido: 'PN',
      legislaturas: [49, 50],
      camara: 'senado',
    })
  })

  it('consulta asistencias del Senado con la URL por legislatura', async () => {
    fetchMock.mockResolvedValueOnce(
      crearRespuestaJson([{ Nombre: 'Bianchi, Graciela' }, { Nombre: 'Andrade, Oscar' }]),
    )

    const registros = await obtenerAsistenciasSenadoPorLegislatura(46)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toContain('Fecha_desde=2005-02-15')
    expect(registros.map((registro) => registro.nombre)).toEqual([
      'Andrade, Oscar',
      'Bianchi, Graciela',
    ])
  })

  it('tolera biografías caídas y devuelve vacío', async () => {
    fetchMock.mockResolvedValueOnce(
      crearRespuestaTexto('Your PHP version must be equal or higher than 7.2.0 to use CakePHP'),
    )

    const registros = await obtenerBiografiasParlamento(49, 'senado')

    expect(registros).toEqual([])
  })
})
