import pdfParse from 'pdf-parse'
import { fetchConReintentos } from '../utils/http.js'

const URL_VOTACIONES = 'https://documentos.diputados.gub.uy/docs/DAvotaciones.json'
const URL_DIARIO_SESIONES = 'https://documentos.diputados.gub.uy/docs/DAdiarioSesiones.json'

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
