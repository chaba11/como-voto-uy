import type { ProyectoExtraido } from './tipos-parser.js'

/**
 * Extrae información del proyecto de ley del texto de contexto de una votación.
 *
 * Busca:
 * - Carpeta n.° XXXX o Carp. n.° XXXX
 * - Repartido n.° XXXX o rep. n.° XXXX
 * - Nombre del proyecto ("Proyecto de ley por el que se...")
 */
export function extraerProyecto(textoContexto: string): ProyectoExtraido {
  const proyecto: ProyectoExtraido = {}

  // Extraer número de carpeta
  // Variantes: "Carpeta n.° 1181", "carpeta n.º 1398", "Carp. n.° 1159", "carpeta N.º XXXX"
  const patronCarpeta =
    /(?:carpeta|carp\.?)\s+[Nn]\.?\s*[°ºo]?\s*(\d+)/i

  const matchCarpeta = patronCarpeta.exec(textoContexto)
  if (matchCarpeta) {
    proyecto.carpeta = matchCarpeta[1]
  }

  // Extraer número de repartido
  // Variantes: "Repartido n.° 859", "rep. n.° 859", "Repartido N.º XXXX"
  const patronRepartido =
    /(?:repartido|rep\.?)\s+[Nn]\.?\s*[°ºo]?\s*(\d+)/i

  const matchRepartido = patronRepartido.exec(textoContexto)
  if (matchRepartido) {
    proyecto.repartido = matchRepartido[1]
  }

  // Extraer nombre del proyecto
  const patronNombre =
    /[Pp]royecto\s+de\s+(?:ley|minuta\s+de\s+comunicaci[oó]n)\s+(?:por\s+el\s+que\s+se\s+)?(.+?)(?:\.|$)/i

  const matchNombre = patronNombre.exec(textoContexto)
  if (matchNombre) {
    proyecto.nombre = matchNombre[0]
      .trim()
      .replace(/\.$/, '')
  }

  return proyecto
}
