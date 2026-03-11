import { canonizarAsunto } from './canonizador-asuntos.js'
import type { ProyectoExtraido } from './tipos-parser.js'

const PATRON_CARPETA = /(?:carpeta|carp\.?)\s+[Nn]\.?\s*[°ºo]?\s*(\d+)/i
const PATRON_REPARTIDO = /(?:repartido|rep\.?)\s+[Nn]\.?\s*[°ºo]?\s*(\d+)/i

function extraerFragmentoProyecto(textoContexto: string): string | undefined {
  const patrones = [
    /proyecto\s+de\s+(?:ley|minuta\s+de\s+comunicación|resolución|decreto)[\s\S]*?(?:\.\s|$)/i,
    /mensaje\s+del\s+poder\s+ejecutivo[\s\S]*?(?:\.\s|$)/i,
    /\d+\)\s+([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s,/-]+?)(?:\n|\.\s)/,
  ]

  for (const patron of patrones) {
    const match = patron.exec(textoContexto)
    if (match?.[0]) {
      return match[0].trim()
    }
  }

  return undefined
}

export function extraerProyecto(textoContexto: string): ProyectoExtraido {
  const proyecto: ProyectoExtraido = {}

  const matchCarpeta = PATRON_CARPETA.exec(textoContexto)
  if (matchCarpeta) {
    proyecto.carpeta = matchCarpeta[1]
  }

  const matchRepartido = PATRON_REPARTIDO.exec(textoContexto)
  if (matchRepartido) {
    proyecto.repartido = matchRepartido[1]
  }

  const fragmento = extraerFragmentoProyecto(textoContexto)
  if (fragmento) {
    const canonico = canonizarAsunto({
      nombreCrudo: fragmento,
      textoContexto,
      carpeta: proyecto.carpeta,
      repartido: proyecto.repartido,
    })

    proyecto.nombre = canonico.nombre
    proyecto.tipoAsunto = canonico.tipoAsunto
  }

  return proyecto
}
