import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchConReintentos } from '../../src/utils/http.js'

vi.mock('../../src/utils/http.js', () => ({
  fetchConReintentos: vi.fn(),
}))

vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}))

const fetchMock = fetchConReintentos as ReturnType<typeof vi.fn>

const { default: pdfParseMock } = await import('pdf-parse')
const pdfParseFn = pdfParseMock as ReturnType<typeof vi.fn>

const { obtenerVotacionesRepresentantes, obtenerDiariosSesiones, descargarDiarioPdf } =
  await import('../../src/scraper/votaciones-representantes.js')

const votacionesEjemplo = [
  {
    Sesion: 1,
    SesionFecha: '2025/03/12',
    Votacion: '1',
    Tipo: 'E',
    SiVoto: '50',
    NoVoto: '30',
    Lista_Si: ['Abdala, Pablo D.', 'García, María'],
    Lista_No: ['López, Juan'],
  },
  {
    Sesion: 1,
    SesionFecha: '2025/03/12',
    Votacion: '2',
    Tipo: 'E',
    SiVoto: '60',
    NoVoto: '20',
    Lista_Si: ['Abdala, Pablo D.'],
    Lista_No: ['López, Juan', 'García, María'],
  },
]

const diariosEjemplo = [
  {
    Legislatura: '50',
    Periodo: '1',
    Tipo: 'O',
    Sesion: 1,
    SesionTipo: 'Ordinaria',
    SesionFecha: '2025/03/12',
    Diario: 4200,
    URL: 'https://documentos.diputados.gub.uy/docs/diario4200.pdf',
  },
]

function crearRespuestaJson(datos: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(datos),
  } as Response
}

function crearRespuestaError(status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
  } as Response
}

function crearRespuestaBuffer(buffer: Buffer): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: () =>
      Promise.resolve(
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      ),
  } as Response
}

describe('obtenerVotacionesRepresentantes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('obtiene y retorna las votaciones como array tipado', async () => {
    fetchMock.mockResolvedValueOnce(crearRespuestaJson(votacionesEjemplo))

    const resultado = await obtenerVotacionesRepresentantes()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://documentos.diputados.gub.uy/docs/DAvotaciones.json',
    )
    expect(resultado).toHaveLength(2)
    expect(resultado[0].Sesion).toBe(1)
    expect(resultado[0].SesionFecha).toBe('2025/03/12')
    expect(resultado[0].Lista_Si).toEqual(['Abdala, Pablo D.', 'García, María'])
    expect(resultado[1].Votacion).toBe('2')
  })

  it('lanza error cuando la respuesta no es exitosa', async () => {
    fetchMock.mockResolvedValueOnce(crearRespuestaError(500, 'Internal Server Error'))

    await expect(obtenerVotacionesRepresentantes()).rejects.toThrow(
      'Error al obtener votaciones: 500 Internal Server Error',
    )
  })
})

describe('obtenerDiariosSesiones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('obtiene y retorna los diarios de sesiones como array tipado', async () => {
    fetchMock.mockResolvedValueOnce(crearRespuestaJson(diariosEjemplo))

    const resultado = await obtenerDiariosSesiones()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://documentos.diputados.gub.uy/docs/DAdiarioSesiones.json',
    )
    expect(resultado).toHaveLength(1)
    expect(resultado[0].Legislatura).toBe('50')
    expect(resultado[0].Sesion).toBe(1)
    expect(resultado[0].URL).toContain('diario4200.pdf')
  })

  it('lanza error cuando la respuesta no es exitosa', async () => {
    fetchMock.mockResolvedValueOnce(crearRespuestaError(404, 'Not Found'))

    await expect(obtenerDiariosSesiones()).rejects.toThrow(
      'Error al obtener diarios de sesiones: 404 Not Found',
    )
  })
})

describe('descargarDiarioPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('descarga el PDF y extrae el texto', async () => {
    const textoEsperado = 'Contenido del diario de sesión'
    const bufferFalso = Buffer.from('fake-pdf-content')

    fetchMock.mockResolvedValueOnce(crearRespuestaBuffer(bufferFalso))
    pdfParseFn.mockResolvedValueOnce({
      text: textoEsperado,
      numpages: 1,
      numrender: 1,
      info: {},
      metadata: null,
      version: '1.0',
    })

    const resultado = await descargarDiarioPdf('https://example.com/diario.pdf')

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/diario.pdf')
    expect(pdfParseFn).toHaveBeenCalledOnce()
    expect(resultado).toBe(textoEsperado)
  })

  it('lanza error cuando la respuesta no es exitosa', async () => {
    fetchMock.mockResolvedValueOnce(crearRespuestaError(403, 'Forbidden'))

    await expect(descargarDiarioPdf('https://example.com/diario.pdf')).rejects.toThrow(
      'Error al descargar diario PDF: 403 Forbidden',
    )
  })
})
