import { LEGISLATURAS, URLS_TAQUIGRAFICAS } from '@como-voto-uy/shared'
import { fetchConReintentos } from '../utils/http.js'
import type { Camara, EntradaListado } from './tipos-scraper.js'

const RESULTADOS_POR_PAGINA = 40

function formatearFechaParaUrl(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split('-')
  return `${dia}-${mes}-${anio}`
}

function convertirFecha(fechaDdMmYyyy: string): string {
  const [dia, mes, anio] = fechaDdMmYyyy.trim().split('-')
  return `${anio}-${mes}-${dia}`
}

function construirUrl(camara: Camara, legislaturaNumero: number, pagina: number): string {
  const legislatura = LEGISLATURAS.find((l) => l.numero === legislaturaNumero)
  if (!legislatura) {
    throw new Error(`Legislatura ${legislaturaNumero} no encontrada`)
  }

  const fechaDesde = formatearFechaParaUrl(legislatura.fechaInicio)
  const fechaHasta = legislatura.fechaFin
    ? formatearFechaParaUrl(legislatura.fechaFin)
    : formatearFechaParaUrl(new Date().toISOString().slice(0, 10))

  const urlBase = URLS_TAQUIGRAFICAS[camara === 'senado' ? 'senado' : 'representantes']

  const params = new URLSearchParams({
    Lgl_Nro: String(legislaturaNumero),
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    page: String(pagina),
  })

  return `${urlBase}?${params.toString()}`
}

export function parsearListadoHtml(html: string): EntradaListado[] {
  const entradas: EntradaListado[] = []

  // Regex to match each table row in tbody
  const filaRegex = /<tr>\s*([\s\S]*?)\s*<\/tr>/g
  let filaMatch: RegExpExecArray | null

  while ((filaMatch = filaRegex.exec(html)) !== null) {
    const fila = filaMatch[1]

    // Extract sesion number
    const sesionMatch = fila.match(/views-field-Ssn-Nro[^>]*>(\d+)\s*<\/td>/)
    if (!sesionMatch) continue

    // Extract fecha
    const fechaMatch = fila.match(/views-field-DS-Fecha[^>]*>(\d{2}-\d{2}-\d{4})\s*<\/td>/)
    if (!fechaMatch) continue

    // Extract diario number
    const diarioMatch = fila.match(/views-field-TS-Diario[^>]*>(\d+)\s*<\/td>/)
    if (!diarioMatch) continue

    // Extract resumen
    const resumenMatch = fila.match(/views-field-DS-Texto-Sumario[^>]*>([\s\S]*?)\s*<\/td>/)
    if (!resumenMatch) continue

    // Prefer SSN (HTML) link over IMG (PDF) link
    const ssnMatch = fila.match(/views-field-DS-File-SSN[^>]*><a\s+href="([^"]+)"/)
    const imgMatch = fila.match(/views-field-DS-File-IMG[^>]*><a\s+href="([^"]+)"/)

    const tieneHtml = !!ssnMatch
    const url = ssnMatch?.[1] || imgMatch?.[1]
    if (!url) continue

    entradas.push({
      sesionNumero: parseInt(sesionMatch[1], 10),
      fecha: convertirFecha(fechaMatch[1]),
      diarioNumero: parseInt(diarioMatch[1], 10),
      resumen: resumenMatch[1].trim(),
      urlDocumentoPagina: url,
      tipoDocumento: tieneHtml ? 'html' : 'pdf',
    })
  }

  return entradas
}

export async function obtenerListadoSesiones(
  camara: Camara,
  legislaturaNumero: number,
): Promise<EntradaListado[]> {
  const todasLasEntradas: EntradaListado[] = []
  let pagina = 0

  while (true) {
    const url = construirUrl(camara, legislaturaNumero, pagina)
    const respuesta = await fetchConReintentos(url)
    const html = await respuesta.text()

    const entradas = parsearListadoHtml(html)

    if (entradas.length === 0) break

    todasLasEntradas.push(...entradas)

    if (entradas.length < RESULTADOS_POR_PAGINA) break

    pagina++
  }

  return todasLasEntradas
}
