import { fetchConReintentos } from '../utils/http.js'
import { extraerTextoDePdf, extraerTextoDeHtml } from './extractor-texto.js'
import type { DocumentoDescargado, EntradaListado } from './tipos-scraper.js'

export function extraerUrlDescarga(htmlPagina: string): string | null {
  const match = htmlPagina.match(/href="(https?:\/\/infolegislativa[^"]+)"/)
  return match?.[1] ?? null
}

export function detectarCharset(html: string): string {
  // Check <meta charset="...">
  const charsetMatch = html.match(/charset=["']?([^"';\s>]+)/i)
  if (charsetMatch) {
    return charsetMatch[1].toLowerCase()
  }
  return 'utf-8'
}

export async function descargarDocumento(entrada: EntradaListado): Promise<DocumentoDescargado> {
  // Fetch the document page to get the actual download URL
  const respuestaPagina = await fetchConReintentos(entrada.urlDocumentoPagina)
  const htmlPagina = await respuestaPagina.text()

  const urlDescarga = extraerUrlDescarga(htmlPagina)
  if (!urlDescarga) {
    throw new Error(`No se encontró URL de descarga en ${entrada.urlDocumentoPagina}`)
  }

  // Download the actual document
  const respuestaDoc = await fetchConReintentos(urlDescarga)

  let contenido: string

  if (entrada.tipoDocumento === 'html') {
    // Get raw bytes to handle charset detection
    const buffer = Buffer.from(await respuestaDoc.arrayBuffer())
    const charset = detectarCharset(buffer.toString('ascii', 0, Math.min(buffer.length, 1024)))

    if (charset === 'iso-8859-1' || charset === 'latin1') {
      contenido = extraerTextoDeHtml(buffer.toString('latin1'))
    } else {
      contenido = extraerTextoDeHtml(buffer.toString('utf-8'))
    }
  } else {
    // PDF
    const buffer = Buffer.from(await respuestaDoc.arrayBuffer())
    contenido = await extraerTextoDePdf(buffer)
  }

  return {
    entrada,
    contenido,
    urlOriginal: urlDescarga,
  }
}
