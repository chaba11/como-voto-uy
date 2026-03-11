import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchConReintentos } from '../../src/utils/http.js'

vi.mock('../../src/utils/http.js', () => ({
  fetchConReintentos: vi.fn(),
}))

const fetchMock = fetchConReintentos as ReturnType<typeof vi.fn>

const {
  decodificarTextoFuente,
  extraerAfiliacionesPerfilLegisladorDesdeHtml,
  extraerIntegracionHistoricaDesdeJson,
  extraerResultadosBusquedaLegisladoresDesdeHtml,
  generarAliasesNombreOficial,
  obtenerFechasMuestreoLegislatura,
  URL_NOMINA_REPRESENTANTES_ACTUAL,
  extraerAsistenciasSenadoDesdeJson,
  extraerBiografiaLegisladorDesdeHtml,
  extraerNominaRepresentantesDesdeCsv,
  extraerPadronRepresentantesDesdeTexto,
  normalizarNombreFuente,
  obtenerAsistenciasSenadoPorLegislatura,
  obtenerBiografiasParlamento,
  parsearAfiliacionesCuradasCsv,
} = await import('../../src/scraper/afiliaciones-legisladores.js')

function crearRespuestaJson(datos: unknown, status = 200): Response {
  const texto = JSON.stringify(datos)
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(datos),
    text: () => Promise.resolve(texto),
    arrayBuffer: () => Promise.resolve(Buffer.from(texto, 'utf8')),
  } as Response
}

function crearRespuestaTexto(texto: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: () => Promise.resolve(texto),
    arrayBuffer: () => Promise.resolve(Buffer.from(texto, 'utf8')),
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

  it('normaliza nombres oficiales y genera aliases útiles', () => {
    const nombre = normalizarNombreFuente('ALDAYA GONZÁLEZ, VÍCTOR MARTÍN')
    const aliases = generarAliasesNombreOficial(nombre)

    expect(nombre).toBe('Aldaya González, Víctor Martín')
    expect(aliases).toEqual(
      expect.arrayContaining([
        'Aldaya González, Víctor Martín',
        'Aldaya, Víctor',
        'Víctor Aldaya',
      ]),
    )
  })

  it('prefiere decodificación Windows-1252 cuando UTF-8 viene roto', () => {
    const bytes = new Uint8Array(
      Buffer.from('ALDAYA GONZÁLEZ, VÍCTOR MARTÍN', 'latin1'),
    )
    const texto = decodificarTextoFuente(bytes)

    expect(texto).toContain('GONZÁLEZ')
    expect(texto).toContain('VÍCTOR')
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

  it('parsea un CSV curado versionado', () => {
    const csv = [
      'nombre,camara,legislatura,sigla_partido,tipo_registro,fuente_url,fuente_tipo,metodo,nivel_confianza',
      '"Bianchi, Graciela",senado,49,PN,integrante_temporal,https://example.com,dataset,dataset,alto',
    ].join('\n')

    const registros = parsearAfiliacionesCuradasCsv(csv)

    expect(registros).toHaveLength(1)
    expect(registros[0]).toMatchObject({
      nombre: 'Bianchi, Graciela',
      camara: 'senado',
      legislatura: 49,
      siglaPartido: 'PN',
      metodo: 'dataset',
    })
  })

  it('parsea integración histórica oficial y separa titulares de suplentes', () => {
    const registros = extraerIntegracionHistoricaDesdeJson(
      [
        {
          Psn_ApeNomDeFirma:
            '<a href="http://parlamento.gub.uy/camarasycomisiones/legisladores/98">Abreu, Sergio</a>',
          Lm_Nombre: 'PARTIDO NACIONAL',
          Cpo_Codigo: 'Cámara de Senadores',
          Tm_Nombre: '',
        },
        {
          Psn_ApeNomDeFirma:
            '<a href="http://parlamento.gub.uy/camarasycomisiones/legisladores/759">Baráibar, Carlos</a><br> Baráibar, Carlos sustituye al Senador Astori, Danilo durante la licencia ... <a href="http://parlamento.gub.uy/camarasycomisiones/legisladores/479">Ver Titular</a>',
          Lm_Nombre: 'PARTIDO FRENTE AMPLIO',
          Cpo_Codigo: 'Cámara de Senadores',
          Tm_Nombre: '',
        },
        {
          Psn_ApeNomDeFirma:
            '<a href="http://parlamento.gub.uy/camarasycomisiones/legisladores/1">No corresponde</a>',
          Lm_Nombre: 'PARTIDO NACIONAL',
          Cpo_Codigo: 'Cámara de Representantes',
          Tm_Nombre: '',
        },
      ],
      46,
      'senado',
      'https://parlamento.gub.uy/sobreelparlamento/integracionhistorica/josn?...',
    )

    expect(registros).toHaveLength(2)
    expect(registros[0]).toMatchObject({
      nombre: 'Abreu, Sergio',
      siglaPartido: 'PN',
      tipoRegistro: 'titular',
      metodo: 'dataset',
      nivelConfianza: 'confirmado',
    })
    expect(registros[1]).toMatchObject({
      nombre: 'Baráibar, Carlos',
      siglaPartido: 'FA',
      tipoRegistro: 'integrante_temporal',
    })
  })

  it('genera fechas de muestreo mensuales e incluye el inicio real de la legislatura', () => {
    const fechas = obtenerFechasMuestreoLegislatura(46, 12)

    expect(fechas[0]).toBe('2005-02-15')
    expect(fechas).toContain('2005-02-01')
    expect(fechas.length).toBeGreaterThan(4)
  })

  it('parsea resultados del directorio de legisladores', () => {
    const html = `
      <table>
        <tr>
          <td class="views-field views-field-field-persona-nombre"><a href="/camarasycomisiones/legisladores/479">Astori , Danilo </a></td>
          <td class="views-field views-field-field-persona-desc">Senador de la República por el Lema PARTIDO FRENTE AMPLIO</td>
        </tr>
      </table>
    `

    const resultados = extraerResultadosBusquedaLegisladoresDesdeHtml(html)

    expect(resultados).toEqual([
      {
        id: 479,
        nombre: 'Astori, Danilo',
        descripcion: 'Senador de la República por el Lema PARTIDO FRENTE AMPLIO',
      },
    ])
  })

  it('parsea afiliaciones históricas desde la ficha de legislador', () => {
    const html = `
      <div class="field field--name-field-persona-desc">Representante Nacional por el Lema PARTIDO NACIONAL, departamento de CANELONES</div>
      <div class="views-field views-field-Texto"><span class="field-content">Representante Nacional por el Lema PARTIDO NACIONAL - Legislatura XLIX (2020-2025)</span></div>
      <div class="views-field views-field-Texto"><span class="field-content">Senador de la República por el Lema PARTIDO FRENTE AMPLIO - Legislatura XLVIII (2015-2020)</span></div>
    `

    const afiliaciones = extraerAfiliacionesPerfilLegisladorDesdeHtml(html)

    expect(afiliaciones).toEqual(
      expect.arrayContaining([
        {
          camara: 'representantes',
          legislatura: 49,
          siglaPartido: 'PN',
        },
        {
          camara: 'senado',
          legislatura: 48,
          siglaPartido: 'FA',
        },
      ]),
    )
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
