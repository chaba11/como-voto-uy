import type { ResultadoParseo, VotacionExtraida } from './tipos-parser.js'
import { detectarVotaciones } from './detector-votacion.js'
import { extraerVotosNominales, extraerResultadoAgregado } from './extractor-votos.js'
import { extraerProyecto } from './extractor-proyecto.js'
import { extraerAsistencia } from './extractor-asistencia.js'

// Re-exportar tipos y funciones
export type {
  VotacionExtraida,
  VotoExtraido,
  ResultadoAgregado,
  ProyectoExtraido,
  ResultadoParseo,
} from './tipos-parser.js'
export type { SeccionVotacion } from './detector-votacion.js'
export type { LlmConfig } from './llm-fallback.js'

export { detectarVotaciones } from './detector-votacion.js'
export { extraerVotosNominales, extraerResultadoAgregado, convertirNumeroEscrito } from './extractor-votos.js'
export { extraerProyecto } from './extractor-proyecto.js'
export { extraerAsistencia } from './extractor-asistencia.js'
export { normalizarNombre, sinAcentos, buscarLegislador } from './normalizador-nombres.js'
export { parsearConLlm } from './llm-fallback.js'

/**
 * Parsea el texto completo de una taquigráfica y extrae toda la información
 * de votaciones, asistencia y proyectos.
 */
export function parsearTaquigrafica(texto: string): ResultadoParseo {
  const secciones = detectarVotaciones(texto)
  const { asistentes, ausentes } = extraerAsistencia(texto)

  const votaciones: VotacionExtraida[] = secciones.map((seccion) => {
    const votacion: VotacionExtraida = {
      tipo: seccion.tipo,
      textoContexto: seccion.texto,
      votos: [],
    }

    if (seccion.tipo === 'nominal') {
      votacion.votos = extraerVotosNominales(seccion.texto)
      // Una votación nominal también puede tener un resultado agregado
      votacion.resultado = extraerResultadoAgregado(seccion.texto) ?? undefined
    } else {
      votacion.resultado = extraerResultadoAgregado(seccion.texto) ?? undefined
    }

    // Extraer proyecto asociado
    votacion.proyecto = extraerProyecto(seccion.texto)

    return votacion
  })

  return {
    sesionTexto: texto,
    votaciones,
    asistentes,
    ausentes,
  }
}
