import {
  LEGISLATURAS,
  type Camara,
  type MetodoResolucionAfiliacion,
  type NivelConfianzaVoto,
  type TipoFuente,
  type TipoRegistroAfiliacion,
} from '@como-voto-uy/shared'
import { resolverSiglaPartido } from '../seed/partidos.js'
import { fetchConReintentos } from '../utils/http.js'
import {
  URL_PADRON_REPRESENTANTES,
  extraerPadronRepresentantesDesdeTexto,
  obtenerPadronRepresentantes,
} from './votaciones-representantes.js'

const URL_NOMINA_REPRESENTANTES_ACTUAL =
  'https://documentos.diputados.gub.uy/docs/integracion.csv'
const URL_NOMINA_REPRESENTANTES_AMPLIADA =
  'https://documentos.diputados.gub.uy/docs/DAdiputadosNomina2.csv'
const URL_ASISTENCIAS_SENADO =
  'https://parlamento.gub.uy/camarasycomisiones/senadores/transparencia/datos-abiertos/asistencia-a-sesiones/json'
const URL_BIBLIOTECA_BIOGRAFIAS = 'https://biblioteca.parlamento.gub.uy/biografias/'

export interface RegistroAfiliacionFuente {
  nombre: string
  camara: Camara
  legislatura: number
  siglaPartido: string | null
  tipoRegistro: TipoRegistroAfiliacion
  fuente: {
    tipo: TipoFuente
    url: string
  }
  metodo: MetodoResolucionAfiliacion
  nivelConfianza: NivelConfianzaVoto
  departamento?: string
  alias?: string[]
}

interface FilaCsv {
  [clave: string]: string
}

interface AsistenciaSenadoApi {
  Nombre?: string
}

export interface BiografiaExtraida {
  nombre: string
  siglaPartido: string | null
  legislaturas: number[]
  camara: Camara | null
}

function parsearLineaCsv(linea: string): string[] {
  const columnas: string[] = []
  let actual = ''
  let enComillas = false

  for (let indice = 0; indice < linea.length; indice++) {
    const caracter = linea[indice]
    if (caracter === '"') {
      if (enComillas && linea[indice + 1] === '"') {
        actual += '"'
        indice++
      } else {
        enComillas = !enComillas
      }
      continue
    }

    if (caracter === ',' && !enComillas) {
      columnas.push(actual.trim())
      actual = ''
      continue
    }

    actual += caracter
  }

  columnas.push(actual.trim())
  return columnas
}

export function parsearCsv(textoCsv: string): FilaCsv[] {
  const lineas = textoCsv
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)

  if (lineas.length === 0) return []

  const encabezados = parsearLineaCsv(lineas[0])
  return lineas.slice(1).map((linea) => {
    const valores = parsearLineaCsv(linea)
    return encabezados.reduce<FilaCsv>((fila, encabezado, indice) => {
      fila[encabezado] = valores[indice] ?? ''
      return fila
    }, {})
  })
}

function crearRegistroRepresentante(
  fila: FilaCsv,
  tipoRegistro: TipoRegistroAfiliacion,
  url: string,
): RegistroAfiliacionFuente | null {
  const nombre = fila.Nombre?.trim()
  if (!nombre) return null

  return {
    nombre,
    camara: 'representantes',
    legislatura: 50,
    siglaPartido: resolverSiglaPartido(fila.PartidoPolitico),
    tipoRegistro,
    fuente: {
      tipo: 'dataset',
      url,
    },
    metodo: 'dataset',
    nivelConfianza: 'confirmado',
    departamento: fila.Departamento?.trim() || undefined,
    alias: [nombre],
  }
}

export function extraerNominaRepresentantesDesdeCsv(
  textoCsv: string,
  tipoRegistro: TipoRegistroAfiliacion,
  url: string,
): RegistroAfiliacionFuente[] {
  return parsearCsv(textoCsv)
    .map((fila) => crearRegistroRepresentante(fila, tipoRegistro, url))
    .filter((registro): registro is RegistroAfiliacionFuente => registro !== null)
}

async function descargarCsv(url: string): Promise<string> {
  const respuesta = await fetchConReintentos(url)
  if (!respuesta.ok) {
    throw new Error(`Error al descargar CSV: ${respuesta.status} ${respuesta.statusText}`)
  }
  return await respuesta.text()
}

export async function obtenerNominaRepresentantesActual(): Promise<RegistroAfiliacionFuente[]> {
  const csv = await descargarCsv(URL_NOMINA_REPRESENTANTES_ACTUAL)
  return extraerNominaRepresentantesDesdeCsv(csv, 'titular', URL_NOMINA_REPRESENTANTES_ACTUAL)
}

export async function obtenerNominaRepresentantesAmpliada(): Promise<RegistroAfiliacionFuente[]> {
  const csv = await descargarCsv(URL_NOMINA_REPRESENTANTES_AMPLIADA)
  return extraerNominaRepresentantesDesdeCsv(
    csv,
    'suplente',
    URL_NOMINA_REPRESENTANTES_AMPLIADA,
  )
}

export async function obtenerPadronRepresentantesComoAfiliaciones(): Promise<
  RegistroAfiliacionFuente[]
> {
  const padron = await obtenerPadronRepresentantes()
  return padron.map((legislador) => ({
    nombre: legislador.nombre,
    camara: 'representantes' as const,
    legislatura: 50,
    siglaPartido: legislador.siglaPartido,
    tipoRegistro: 'titular' as const,
    fuente: {
      tipo: 'diario_pdf' as const,
      url: URL_PADRON_REPRESENTANTES,
    },
    metodo: 'padron_pdf' as const,
    nivelConfianza: 'alto' as const,
    alias: [legislador.nombre],
  }))
}

export function extraerAsistenciasSenadoDesdeJson(
  datos: AsistenciaSenadoApi[],
  legislatura: number,
): RegistroAfiliacionFuente[] {
  const nombres = new Set<string>()

  for (const fila of datos) {
    const nombre = fila.Nombre?.trim()
    if (nombre) nombres.add(nombre)
  }

  return [...nombres].sort().map((nombre) => ({
    nombre,
    camara: 'senado' as const,
    legislatura,
    siglaPartido: null,
    tipoRegistro: 'integrante_temporal' as const,
    fuente: {
      tipo: 'json' as const,
      url: `${URL_ASISTENCIAS_SENADO}?legislatura=${legislatura}`,
    },
    metodo: 'asistencia' as const,
    nivelConfianza: 'medio' as const,
    alias: [nombre],
  }))
}

export async function obtenerAsistenciasSenadoPorLegislatura(
  legislatura: number,
): Promise<RegistroAfiliacionFuente[]> {
  const infoLegislatura = LEGISLATURAS.find((item) => item.numero === legislatura)
  if (!infoLegislatura) {
    throw new Error(`Legislatura ${legislatura} no definida`)
  }

  const fechaHasta = infoLegislatura.fechaFin ?? new Date().toISOString().slice(0, 10)
  const url =
    `${URL_ASISTENCIAS_SENADO}?Fecha_desde=${infoLegislatura.fechaInicio}` +
    `&Fecha_hasta=${fechaHasta}&_format=json&page=0`
  const respuesta = await fetchConReintentos(url)

  if (!respuesta.ok) {
    throw new Error(
      `Error al obtener asistencias del Senado: ${respuesta.status} ${respuesta.statusText}`,
    )
  }

  const datos = (await respuesta.json()) as AsistenciaSenadoApi[]
  return extraerAsistenciasSenadoDesdeJson(datos, legislatura).map((registro) => ({
    ...registro,
    fuente: {
      ...registro.fuente,
      url,
    },
  }))
}

function limpiarHtml(texto: string): string {
  return texto.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function extraerBiografiaLegisladorDesdeHtml(html: string): BiografiaExtraida | null {
  const nombre =
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim() ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.split('|')[0]?.trim()

  if (!nombre) return null

  const texto = limpiarHtml(html)
  const siglaPartido = (() => {
    const lema = texto.match(/(?:Lema|Partido)\s*:?\s*([^.;]+)/i)?.[1]?.trim()
    return resolverSiglaPartido(lema) ?? null
  })()

  const legislaturas = [...texto.matchAll(/Legislatura\s+(\d{2})/gi)].map((match) =>
    parseInt(match[1], 10),
  )

  let camara: Camara | null = null
  if (/senador(?:a)?/i.test(texto)) camara = 'senado'
  if (/diputad(?:o|a)/i.test(texto)) camara = 'representantes'

  return {
    nombre,
    siglaPartido,
    legislaturas: [...new Set(legislaturas)],
    camara,
  }
}

export async function obtenerBiografiasParlamento(
  legislatura: number,
  camara?: Camara,
): Promise<RegistroAfiliacionFuente[]> {
  const url = `${URL_BIBLIOTECA_BIOGRAFIAS}`

  try {
    const respuesta = await fetchConReintentos(url)
    if (!respuesta.ok) return []

    const html = await respuesta.text()
    if (/CakePHP|PHP version/i.test(html)) {
      return []
    }

    const registros: RegistroAfiliacionFuente[] = []
    const candidatos = html.match(/href="\/biografias\/legislador\/\d+"/gi) ?? []
    const urls = [...new Set(candidatos)].slice(0, 25)

    for (const candidato of urls) {
      const detalleUrl = new URL(
        candidato.replace(/href="|"/g, ''),
        URL_BIBLIOTECA_BIOGRAFIAS,
      ).toString()
      try {
        const detalle = await fetchConReintentos(detalleUrl)
        if (!detalle.ok) continue
        const detalleHtml = await detalle.text()
        if (/CakePHP|PHP version/i.test(detalleHtml)) continue

        const biografia = extraerBiografiaLegisladorDesdeHtml(detalleHtml)
        if (!biografia) continue
        if (!biografia.legislaturas.includes(legislatura)) continue
        if (camara && biografia.camara && biografia.camara !== camara) continue

        registros.push({
          nombre: biografia.nombre,
          camara: biografia.camara ?? camara ?? 'senado',
          legislatura,
          siglaPartido: biografia.siglaPartido,
          tipoRegistro: 'titular',
          fuente: {
            tipo: 'manual',
            url: detalleUrl,
          },
          metodo: 'biografia',
          nivelConfianza: biografia.siglaPartido ? 'alto' : 'medio',
          alias: [biografia.nombre],
        })
      } catch {
        continue
      }
    }

    return registros
  } catch {
    return []
  }
}

export async function obtenerRegistrosAfiliacionPorFuente(opciones: {
  camara?: Camara
  legislaturas?: number[]
} = {}): Promise<RegistroAfiliacionFuente[]> {
  const legislaturas = opciones.legislaturas ?? [46, 47, 48, 49, 50]
  const camaras = opciones.camara ? [opciones.camara] : (['senado', 'representantes'] as Camara[])
  const registros: RegistroAfiliacionFuente[] = []

  if (camaras.includes('representantes') && legislaturas.includes(50)) {
    registros.push(...(await obtenerNominaRepresentantesActual()))
    registros.push(...(await obtenerNominaRepresentantesAmpliada()))
    registros.push(...(await obtenerPadronRepresentantesComoAfiliaciones().catch(() => [])))
  }

  if (camaras.includes('senado')) {
    for (const legislatura of legislaturas.filter((numero) => numero >= 46 && numero <= 49)) {
      registros.push(...(await obtenerAsistenciasSenadoPorLegislatura(legislatura).catch(() => [])))
      registros.push(...(await obtenerBiografiasParlamento(legislatura, 'senado')))
    }
  }

  if (camaras.includes('representantes')) {
    for (const legislatura of legislaturas.filter((numero) => numero >= 46 && numero <= 49)) {
      registros.push(...(await obtenerBiografiasParlamento(legislatura, 'representantes')))
    }
  }

  return registros
}

export {
  URL_ASISTENCIAS_SENADO,
  URL_BIBLIOTECA_BIOGRAFIAS,
  URL_NOMINA_REPRESENTANTES_ACTUAL,
  URL_NOMINA_REPRESENTANTES_AMPLIADA,
  extraerPadronRepresentantesDesdeTexto,
}
