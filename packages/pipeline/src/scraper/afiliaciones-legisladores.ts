import {
  LEGISLATURAS,
  type Camara,
  type MetodoResolucionAfiliacion,
  type NivelConfianzaVoto,
  type TipoFuente,
  type TipoRegistroAfiliacion,
} from '@como-voto-uy/shared'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
const URL_INTEGRACION_HISTORICA =
  'https://parlamento.gub.uy/sobreelparlamento/integracionhistorica/josn'
const URL_DIRECTORIO_LEGISLADORES = 'https://parlamento.gub.uy/camarasycomisiones/legisladores'
const DIR_DATOS_AFILIACIONES = join(
  fileURLToPath(new URL('..', import.meta.url)),
  'datos',
  'afiliaciones',
)

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

interface IntegracionHistoricaApi {
  Psn_ApeNomDeFirma?: string
  Lm_Nombre?: string
  Cpo_Codigo?: string
  Tm_Nombre?: string
}

export interface BiografiaExtraida {
  nombre: string
  siglaPartido: string | null
  legislaturas: number[]
  camara: Camara | null
}

export interface ResultadoBusquedaLegislador {
  id: number
  nombre: string
  descripcion: string | null
}

export interface AfiliacionPerfilLegislador {
  legislatura: number
  camara: Camara
  siglaPartido: string | null
}

interface RegistroAfiliacionCuradoCsv extends FilaCsv {
  nombre: string
  camara: Camara
  legislatura: string
  sigla_partido: string
  tipo_registro: TipoRegistroAfiliacion
  fuente_url: string
  fuente_tipo: TipoFuente
  metodo: MetodoResolucionAfiliacion
  nivel_confianza: NivelConfianzaVoto
}

function puntuarDecodificacion(texto: string): number {
  const reemplazos = (texto.match(/�/g) ?? []).length
  const mojibake = (texto.match(/Ã|Â|Ð|�/g) ?? []).length
  const acentos = (texto.match(/[ÁÉÍÓÚÑÜáéíóúñü]/g) ?? []).length
  return acentos * 3 - reemplazos * 10 - mojibake * 4
}

function decodificarTextoFuente(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes)
  const win1252 = new TextDecoder('windows-1252').decode(bytes)
  return puntuarDecodificacion(win1252) > puntuarDecodificacion(utf8) ? win1252 : utf8
}

function capitalizarToken(token: string): string {
  if (!token) return token
  return token[0].toUpperCase() + token.slice(1).toLowerCase()
}

function repararSeparadores(texto: string): string {
  return texto
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*/g, ', ')
    .trim()
}

export function normalizarNombreFuente(nombre: string): string {
  const limpio = repararSeparadores(nombre)
  if (!limpio) return limpio

  const [apellidos, nombres] = limpio.includes(',')
    ? limpio.split(',').map((parte) => parte.trim())
    : [limpio, '']

  const normalizarBloque = (bloque: string) =>
    bloque
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => capitalizarToken(token))
      .join(' ')

  if (!nombres) {
    return normalizarBloque(apellidos)
  }

  return `${normalizarBloque(apellidos)}, ${normalizarBloque(nombres)}`
}

export function generarAliasesNombreOficial(nombre: string): string[] {
  const normalizado = normalizarNombreFuente(nombre)
  if (!normalizado) return []

  const aliases = new Set<string>([normalizado, repararSeparadores(nombre)])
  if (normalizado.includes(',')) {
    const [apellidos, nombres] = normalizado.split(',').map((parte) => parte.trim())
    const apTokens = apellidos.split(/\s+/).filter(Boolean)
    const nomTokens = nombres.split(/\s+/).filter(Boolean)
    const primerApellido = apTokens[0]
    const primerNombre = nomTokens[0]

    aliases.add(`${nombres} ${apellidos}`.trim())
    if (primerApellido && primerNombre) {
      aliases.add(`${primerApellido}, ${primerNombre}`)
      aliases.add(`${primerNombre} ${primerApellido}`)
      aliases.add(`${primerNombre} ${apellidos}`)
      aliases.add(`${apellidos}, ${primerNombre}`)
    }
  }

  return [...aliases].filter(Boolean)
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
  const nombre = normalizarNombreFuente(fila.Nombre?.trim() ?? '')
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
    alias: generarAliasesNombreOficial(nombre),
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
  const bytes = new Uint8Array(await respuesta.arrayBuffer())
  return decodificarTextoFuente(bytes)
}

async function descargarJsonDecodificado<T>(url: string): Promise<T> {
  const respuesta = await fetchConReintentos(url)
  if (!respuesta.ok) {
    throw new Error(`Error al descargar JSON: ${respuesta.status} ${respuesta.statusText}`)
  }

  const bytes = new Uint8Array(await respuesta.arrayBuffer())
  const texto = decodificarTextoFuente(bytes)
  return JSON.parse(texto) as T
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
    nombre: normalizarNombreFuente(legislador.nombre),
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
    alias: generarAliasesNombreOficial(legislador.nombre),
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
    nombre: normalizarNombreFuente(nombre),
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
    alias: generarAliasesNombreOficial(nombre),
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
  const datos = await descargarJsonDecodificado<AsistenciaSenadoApi[]>(url)
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

function obtenerLegislaturaDesdeTexto(texto: string): number | null {
  const match = texto.match(/Legislatura\s+(XLVI|XLVII|XLVIII|XLIX|L)\b/i)
  if (!match) return null

  const mapaRomanos: Record<string, number> = {
    XLVI: 46,
    XLVII: 47,
    XLVIII: 48,
    XLIX: 49,
    L: 50,
  }

  return mapaRomanos[match[1].toUpperCase()] ?? null
}

function obtenerTextoPrimerEnlace(html: string): string {
  return html.match(/>([^<]+)<\/a>/i)?.[1]?.trim() ?? limpiarHtml(html)
}

function extraerTextoSustitucion(html: string): string {
  const limpio = limpiarHtml(html)
  const [principal] = limpio.split(/\s+Ver Titular/i)
  return principal.trim()
}

function construirUrlIntegracionHistorica(
  camara: Camara,
  fecha: string,
  actuantes = true,
): string {
  const cuerpo = camara === 'senado' ? 'S' : 'D'
  const params = new URLSearchParams({
    Cpo_Codigo: cuerpo,
    Quienes: actuantes ? 'I' : 'T',
    'Fecha[date]': fecha,
    'Fecha[time]': '00:00',
    _format: 'json',
  })
  return `${URL_INTEGRACION_HISTORICA}?${params.toString()}`
}

export function obtenerFechasMuestreoLegislatura(
  legislatura: number,
  cadaMeses = 1,
): string[] {
  const infoLegislatura = LEGISLATURAS.find((item) => item.numero === legislatura)
  if (!infoLegislatura) {
    throw new Error(`Legislatura ${legislatura} no definida`)
  }

  const inicio = new Date(`${infoLegislatura.fechaInicio}T00:00:00Z`)
  const fin = new Date(
    `${(infoLegislatura.fechaFin ?? new Date().toISOString().slice(0, 10))}T00:00:00Z`,
  )

  const fechas: string[] = []
  const cursor = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1))
  let indice = 0

  while (cursor <= fin) {
    if (indice % cadaMeses === 0) {
      fechas.push(cursor.toISOString().slice(0, 10))
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    indice++
  }

  const fechaInicio = infoLegislatura.fechaInicio
  if (!fechas.includes(fechaInicio)) {
    fechas.unshift(fechaInicio)
  }

  return [...new Set(fechas)]
}

export function obtenerFechasMuestreoLegislaturaPorDias(
  legislatura: number,
  cadaDias = 7,
): string[] {
  const infoLegislatura = LEGISLATURAS.find((item) => item.numero === legislatura)
  if (!infoLegislatura) {
    throw new Error(`Legislatura ${legislatura} no definida`)
  }

  const inicio = new Date(`${infoLegislatura.fechaInicio}T00:00:00Z`)
  const fin = new Date(
    `${(infoLegislatura.fechaFin ?? new Date().toISOString().slice(0, 10))}T00:00:00Z`,
  )

  const fechas: string[] = []
  const cursor = new Date(inicio)
  while (cursor <= fin) {
    fechas.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + cadaDias)
  }

  if (!fechas.includes(infoLegislatura.fechaInicio)) {
    fechas.unshift(infoLegislatura.fechaInicio)
  }
  if (infoLegislatura.fechaFin && !fechas.includes(infoLegislatura.fechaFin)) {
    fechas.push(infoLegislatura.fechaFin)
  }

  return [...new Set(fechas)]
}

export function extraerIntegracionHistoricaDesdeJson(
  datos: IntegracionHistoricaApi[],
  legislatura: number,
  camara: Camara,
  url: string,
): RegistroAfiliacionFuente[] {
  const cuerpoEsperado =
    camara === 'senado' ? /c[aá]mara de senadores/i : /c[aá]mara de representantes/i

  return datos
    .map((fila) => {
      const cuerpo = fila.Cpo_Codigo?.trim() ?? ''
      if (!cuerpoEsperado.test(cuerpo)) return null

      const htmlNombre = fila.Psn_ApeNomDeFirma?.trim() ?? ''
      const nombreBase = obtenerTextoPrimerEnlace(htmlNombre)
      const detalle = extraerTextoSustitucion(htmlNombre)
      if (!nombreBase || /^sin suplente convocado$/i.test(nombreBase)) return null

      const esSuplente = /sustituye|suple a/i.test(detalle)
      const lema = fila.Lm_Nombre?.trim() ?? ''

      return {
        nombre: normalizarNombreFuente(nombreBase),
        camara,
        legislatura,
        siglaPartido: resolverSiglaPartido(lema),
        tipoRegistro: esSuplente ? 'integrante_temporal' : 'titular',
        fuente: {
          tipo: 'dataset' as const,
          url,
        },
        metodo: 'dataset' as const,
        nivelConfianza: 'confirmado' as const,
        departamento: fila.Tm_Nombre?.trim() || undefined,
        alias: [...new Set(generarAliasesNombreOficial(nombreBase))],
      } satisfies RegistroAfiliacionFuente
    })
    .filter((registro): registro is RegistroAfiliacionFuente => registro !== null)
}

export function extraerResultadosBusquedaLegisladoresDesdeHtml(
  html: string,
): ResultadoBusquedaLegislador[] {
  const resultados: ResultadoBusquedaLegislador[] = []
  const regex =
    /views-field-field-persona-nombre"><a href="\/camarasycomisiones\/legisladores\/(\d+)">([^<]+)<\/a>[\s\S]*?views-field-field-persona-desc">([^<]*)<\/td>/gi

  for (const match of html.matchAll(regex)) {
    resultados.push({
      id: parseInt(match[1], 10),
      nombre: normalizarNombreFuente(match[2].replace(/\s+/g, ' ').replace(/\s+,/g, ',')),
      descripcion: match[3].trim() ? limpiarHtml(match[3]) : null,
    })
  }

  return resultados
}

export function extraerAfiliacionesPerfilLegisladorDesdeHtml(
  html: string,
): AfiliacionPerfilLegislador[] {
  const texto = limpiarHtml(html)
  const afiliaciones = new Map<string, AfiliacionPerfilLegislador>()
  const regexHistorico =
    /(Senador(?:a)? de la Rep[úu]blica|Representante Nacional) por el Lema ([^-]+?) - Legislatura (XLVI|XLVII|XLVIII|XLIX|L)\b/gi

  for (const match of texto.matchAll(regexHistorico)) {
    const camara = /Senador/i.test(match[1]) ? 'senado' : 'representantes'
    const siglaPartido = resolverSiglaPartido(match[2])
    const legislatura = obtenerLegislaturaDesdeTexto(`Legislatura ${match[3]}`)
    if (!legislatura || !siglaPartido) continue
    afiliaciones.set(`${camara}-${legislatura}`, {
      camara,
      legislatura,
      siglaPartido,
    })
  }

  const descripcionActual = texto.match(
    /(Senador(?:a)? de la Rep[úu]blica|Representante Nacional) por el Lema ([^.]+?)(?:,|Legislatura)/i,
  )
  const legislaturaActual = obtenerLegislaturaDesdeTexto(texto)
  if (descripcionActual && legislaturaActual) {
    const camara = /Senador/i.test(descripcionActual[1]) ? 'senado' : 'representantes'
    const siglaPartido = resolverSiglaPartido(descripcionActual[2])
    if (siglaPartido) {
      afiliaciones.set(`${camara}-${legislaturaActual}`, {
        camara,
        legislatura: legislaturaActual,
        siglaPartido,
      })
    }
  }

  return [...afiliaciones.values()]
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
          nombre: normalizarNombreFuente(biografia.nombre),
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
          alias: generarAliasesNombreOficial(biografia.nombre),
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

export async function obtenerIntegracionHistoricaParlamento(
  legislatura: number,
  camara: Camara,
  opciones: {
    cadaMeses?: number
    cadaDias?: number
    concurrencia?: number
  } = {},
): Promise<RegistroAfiliacionFuente[]> {
  const fechas = opciones.cadaDias
    ? obtenerFechasMuestreoLegislaturaPorDias(legislatura, opciones.cadaDias)
    : obtenerFechasMuestreoLegislatura(legislatura, opciones.cadaMeses ?? 1)
  const registros = new Map<string, RegistroAfiliacionFuente>()
  const concurrencia = Math.max(1, opciones.concurrencia ?? 8)

  for (let indice = 0; indice < fechas.length; indice += concurrencia) {
    const bloque = fechas.slice(indice, indice + concurrencia)
    const respuestas = await Promise.all(
      bloque.map(async (fecha) => {
        const url = construirUrlIntegracionHistorica(camara, fecha)
        try {
          const datos = await descargarJsonDecodificado<IntegracionHistoricaApi[]>(url)
          return { datos, url }
        } catch {
          return null
        }
      }),
    )

    for (const respuesta of respuestas) {
      if (!respuesta) continue
      for (const registro of extraerIntegracionHistoricaDesdeJson(
        respuesta.datos,
        legislatura,
        camara,
        respuesta.url,
      )) {
        const clave = `${registro.legislatura}-${registro.camara}-${registro.nombre}`
        const existente = registros.get(clave)
        if (!existente) {
          registros.set(clave, registro)
          continue
        }

        const tipoRegistro =
          existente.tipoRegistro === 'titular' || registro.tipoRegistro !== 'titular'
            ? existente.tipoRegistro
            : 'titular'
        const alias = [...new Set([...(existente.alias ?? []), ...(registro.alias ?? [])])]
        registros.set(clave, {
          ...existente,
          tipoRegistro,
          alias,
        })
      }
    }
  }

  return [...registros.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export function parsearAfiliacionesCuradasCsv(
  textoCsv: string,
): RegistroAfiliacionFuente[] {
  return parsearCsv(textoCsv)
    .map((fila) => fila as unknown as RegistroAfiliacionCuradoCsv)
    .map((fila) => ({
      nombre: normalizarNombreFuente(fila.nombre),
      camara: fila.camara,
      legislatura: parseInt(fila.legislatura, 10),
      siglaPartido: fila.sigla_partido || null,
      tipoRegistro: fila.tipo_registro,
      fuente: {
        tipo: fila.fuente_tipo,
        url: fila.fuente_url,
      },
      metodo: fila.metodo,
      nivelConfianza: fila.nivel_confianza,
      alias: generarAliasesNombreOficial(fila.nombre),
    }))
    .filter((registro) => !!registro.nombre)
}

export function obtenerAfiliacionesCuradasLocales(): RegistroAfiliacionFuente[] {
  try {
    const texto = readFileSync(join(DIR_DATOS_AFILIACIONES, 'senado-curado.csv'), 'utf8')
    return parsearAfiliacionesCuradasCsv(texto)
  } catch {
    return []
  }
}

export async function obtenerRegistrosAfiliacionPorFuente(opciones: {
  camara?: Camara
  legislaturas?: number[]
  incluirCurado?: boolean
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

  if (opciones.incluirCurado ?? true) {
    registros.push(
      ...obtenerAfiliacionesCuradasLocales().filter(
        (registro) =>
          camaras.includes(registro.camara) && legislaturas.includes(registro.legislatura),
      ),
    )
  }

  return registros
}

export {
  URL_ASISTENCIAS_SENADO,
  URL_BIBLIOTECA_BIOGRAFIAS,
  URL_DIRECTORIO_LEGISLADORES,
  URL_INTEGRACION_HISTORICA,
  DIR_DATOS_AFILIACIONES,
  URL_NOMINA_REPRESENTANTES_ACTUAL,
  URL_NOMINA_REPRESENTANTES_AMPLIADA,
  decodificarTextoFuente,
  extraerPadronRepresentantesDesdeTexto,
}
