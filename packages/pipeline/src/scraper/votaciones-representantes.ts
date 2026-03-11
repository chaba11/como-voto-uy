import pdfParse from 'pdf-parse'
import { fetchConReintentos } from '../utils/http.js'

const URL_VOTACIONES = 'https://documentos.diputados.gub.uy/docs/DAvotaciones.json'
const URL_DIARIO_SESIONES = 'https://documentos.diputados.gub.uy/docs/DAdiarioSesiones.json'
const URL_PADRON_REPRESENTANTES = 'https://documentos.diputados.gub.uy/docs/LegxPartido.pdf'

export interface VotacionRepresentantes {
  Sesion: number
  SesionFecha: string
  Votacion: string
  Tipo: string
  SiVoto: string
  NoVoto: string
  Lista_Si: string[]
  Lista_No: string[]
}

export interface DiarioSesion {
  Legislatura: string
  Periodo: string
  Tipo: string
  Sesion: number
  SesionTipo: string
  SesionFecha: string
  Diario: number
  URL: string
}

export interface LegisladorPadronRepresentantes {
  nombre: string
  siglaPartido: string
}

export async function obtenerVotacionesRepresentantes(): Promise<VotacionRepresentantes[]> {
  const respuesta = await fetchConReintentos(URL_VOTACIONES)
  if (!respuesta.ok) {
    throw new Error(`Error al obtener votaciones: ${respuesta.status} ${respuesta.statusText}`)
  }
  const datos: VotacionRepresentantes[] = await respuesta.json()
  return datos
}

export async function obtenerDiariosSesiones(): Promise<DiarioSesion[]> {
  const respuesta = await fetchConReintentos(URL_DIARIO_SESIONES)
  if (!respuesta.ok) {
    throw new Error(`Error al obtener diarios de sesiones: ${respuesta.status} ${respuesta.statusText}`)
  }
  const datos: DiarioSesion[] = await respuesta.json()
  return datos
}

export async function descargarDiarioPdf(url: string): Promise<string> {
  const respuesta = await fetchConReintentos(url)
  if (!respuesta.ok) {
    throw new Error(`Error al descargar diario PDF: ${respuesta.status} ${respuesta.statusText}`)
  }
  const buffer = Buffer.from(await respuesta.arrayBuffer())
  const pdf = await pdfParse(buffer)
  return pdf.text
}

function normalizarLineaPadron(linea: string): string {
  return linea.replace(/\s+/g, ' ').trim()
}

export function extraerPadronRepresentantesDesdeTexto(
  textoPdf: string,
): LegisladorPadronRepresentantes[] {
  const lineas = textoPdf
    .split('\n')
    .map((linea) => normalizarLineaPadron(linea))
    .filter(Boolean)

  const partidosPorPatron: Array<{ patron: RegExp; sigla: string }> = [
    { patron: /^frente amplio$/i, sigla: 'FA' },
    { patron: /^partido nacional$/i, sigla: 'PN' },
    { patron: /^partido colorado$/i, sigla: 'PC' },
    { patron: /^cabildo abierto$/i, sigla: 'CA' },
    { patron: /^partido independiente$/i, sigla: 'PI' },
    { patron: /^partido ecologista radical intransigente$/i, sigla: 'PERI' },
  ]

  const nombres = new Map<string, LegisladorPadronRepresentantes>()
  let siglaActual: string | null = null

  for (const linea of lineas) {
    const partido = partidosPorPatron.find(({ patron }) => patron.test(linea))
    if (partido) {
      siglaActual = partido.sigla
      continue
    }

    if (!siglaActual) continue
    if (/^(legislatura|diputados|representantes|departamento|total|página)\b/i.test(linea)) {
      continue
    }

    const limpia = linea.replace(/^[•\-–—]\s*/, '').trim()
    if (limpia.length < 6) continue
    if (!/[A-Za-zÁÉÍÓÚÑÜ]/.test(limpia)) continue

    const segmentos = limpia
      .split(/\s{2,}| · | \| /)
      .map((segmento) => segmento.trim())
      .filter((segmento) => segmento.length >= 6)

    const candidatos = segmentos.length > 0 ? segmentos : [limpia]
    for (const candidato of candidatos) {
      if (!/,/.test(candidato) && candidato.split(' ').length < 2) continue
      nombres.set(candidato, { nombre: candidato, siglaPartido: siglaActual })
    }
  }

  return [...nombres.values()]
}

export async function obtenerPadronRepresentantes(): Promise<LegisladorPadronRepresentantes[]> {
  const respuesta = await fetchConReintentos(URL_PADRON_REPRESENTANTES)
  if (!respuesta.ok) {
    throw new Error(`Error al obtener padrón de representantes: ${respuesta.status} ${respuesta.statusText}`)
  }

  const buffer = Buffer.from(await respuesta.arrayBuffer())
  const pdf = await pdfParse(buffer)
  return extraerPadronRepresentantesDesdeTexto(pdf.text)
}

export { URL_PADRON_REPRESENTANTES }
