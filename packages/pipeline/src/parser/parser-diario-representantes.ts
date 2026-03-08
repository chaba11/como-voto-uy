import { convertirNumeroEscrito as convertirNumeroBase } from './extractor-votos.js'
import type { VotacionRepresentantes } from '../scraper/votaciones-representantes.js'

/**
 * Extiende convertirNumeroEscrito para manejar "un" (apócope de "uno"),
 * común en texto parlamentario como "un voto negativo".
 */
function convertirNumero(texto: string): number | null {
  const limpio = texto.trim().toLowerCase()
  if (limpio === 'un') return 1
  return convertirNumeroBase(limpio)
}

export interface VotacionDiario {
  afirmativos: number
  negativos: number
  total: number
  resultado: 'afirmativa' | 'negativa'
  textoContexto: string
}

export interface VotacionMatcheada {
  sesion: number
  fecha: string
  votacionNumero: string
  siVoto: number
  noVoto: number
  listaSi: string[]
  listaNo: string[]
  nombreProyecto: string
}

/**
 * Extrae secciones de votación del texto de un PDF de diario de sesiones de Representantes.
 *
 * Busca patrones como:
 * - "——Noventa y cuatro votos afirmativos y un voto negativo en noventa y cinco: AFIRMATIVA."
 * - "——Ochenta en ochenta y uno: AFIRMATIVA."
 * - "——Sesenta por la afirmativa: AFIRMATIVA. Unanimidad."
 */
export function extraerVotacionesDiario(textoPdf: string): VotacionDiario[] {
  const votacionesConPos: Array<VotacionDiario & { posicion: number }> = []

  // Patrón 1: "N votos afirmativos y M negativos en T: RESULTADO"
  // Usamos [^\u2014]+ para no cruzar límites de —— entre votaciones
  const patronAfirmativosNegativos =
    /——([^\u2014]+?)\s+votos?\s+afirmativos?\s+y\s+([^\u2014]+?)\s+votos?\s+negativos?\s+en\s+([^\u2014]+?):\s*(AFIRMATIVA|NEGATIVA)/gi

  let match: RegExpExecArray | null
  while ((match = patronAfirmativosNegativos.exec(textoPdf)) !== null) {
    const afirmativos = convertirNumero(match[1].trim())
    const negativos = convertirNumero(match[2].trim())
    const total = convertirNumero(match[3].trim())
    const resultado = match[4].toLowerCase() as 'afirmativa' | 'negativa'

    if (afirmativos !== null && negativos !== null && total !== null) {
      const inicio = Math.max(0, match.index - 500)
      const textoContexto = textoPdf.substring(inicio, match.index)

      votacionesConPos.push({ afirmativos, negativos, total, resultado, textoContexto, posicion: match.index })
    }
  }

  // Patrón 2: "N en M: RESULTADO"
  const patronEnTotal =
    /——([A-Za-záéíóúñüÁÉÍÓÚÑÜ\s]+?)\s+en\s+([A-Za-záéíóúñüÁÉÍÓÚÑÜ\s]+?):\s*(AFIRMATIVA|NEGATIVA)/gi

  while ((match = patronEnTotal.exec(textoPdf)) !== null) {
    // Evitar duplicados con el patrón 1 (que también contiene "en")
    const textoCompleto = match[0]
    if (/votos?\s+afirmativos?/i.test(textoCompleto)) continue

    const afirmativos = convertirNumero(match[1].trim())
    const total = convertirNumero(match[2].trim())
    const resultado = match[3].toLowerCase() as 'afirmativa' | 'negativa'

    if (afirmativos !== null && total !== null) {
      const negativos = total - afirmativos
      const inicio = Math.max(0, match.index - 500)
      const textoContexto = textoPdf.substring(inicio, match.index)

      votacionesConPos.push({ afirmativos, negativos, total, resultado, textoContexto, posicion: match.index })
    }
  }

  // Patrón 3: "N por la afirmativa: AFIRMATIVA"
  const patronPorAfirmativa =
    /——([A-Za-záéíóúñüÁÉÍÓÚÑÜ\s]+?)\s+por la afirmativa:\s*(AFIRMATIVA)/gi

  while ((match = patronPorAfirmativa.exec(textoPdf)) !== null) {
    const afirmativos = convertirNumero(match[1].trim())
    const resultado = match[2].toLowerCase() as 'afirmativa'

    if (afirmativos !== null) {
      const inicio = Math.max(0, match.index - 500)
      const textoContexto = textoPdf.substring(inicio, match.index)

      votacionesConPos.push({
        afirmativos,
        negativos: 0,
        total: afirmativos,
        resultado,
        textoContexto,
        posicion: match.index,
      })
    }
  }

  // Ordenar por posición en el documento y quitar campo auxiliar
  votacionesConPos.sort((a, b) => a.posicion - b.posicion)

  return votacionesConPos.map(({ posicion: _, ...v }) => v)
}

/**
 * Matchea votaciones del JSON con las del diario de sesiones comparando conteos de votos.
 */
export function matchearVotaciones(
  votacionesJson: VotacionRepresentantes[],
  votacionesDiario: VotacionDiario[],
): VotacionMatcheada[] {
  const resultado: VotacionMatcheada[] = []
  const diarioUsado = new Set<number>()

  for (const vJson of votacionesJson) {
    const siVoto = parseInt(vJson.SiVoto, 10)
    const noVoto = parseInt(vJson.NoVoto, 10)

    // Buscar matches por conteo de votos
    const candidatos: number[] = []
    for (let i = 0; i < votacionesDiario.length; i++) {
      if (diarioUsado.has(i)) continue
      const vDiario = votacionesDiario[i]
      if (vDiario.afirmativos === siVoto && vDiario.negativos === noVoto) {
        candidatos.push(i)
      }
    }

    let nombreProyecto: string
    if (candidatos.length === 1) {
      const idx = candidatos[0]
      diarioUsado.add(idx)
      nombreProyecto = extraerNombreProyecto(votacionesDiario[idx].textoContexto)
    } else if (candidatos.length > 1) {
      // Usar el primero disponible (orden secuencial como desempate)
      const idx = candidatos[0]
      diarioUsado.add(idx)
      nombreProyecto = extraerNombreProyecto(votacionesDiario[idx].textoContexto)
    } else {
      nombreProyecto = `Votación ${vJson.Votacion}`
    }

    resultado.push({
      sesion: vJson.Sesion,
      fecha: vJson.SesionFecha,
      votacionNumero: vJson.Votacion,
      siVoto,
      noVoto,
      listaSi: vJson.Lista_Si,
      listaNo: vJson.Lista_No,
      nombreProyecto,
    })
  }

  return resultado
}

/**
 * Extrae el nombre del proyecto del texto de contexto previo a una votación.
 */
export function extraerNombreProyecto(textoContexto: string): string {
  // Buscar "proyecto de ley" o "proyecto de resolución"
  const patronProyecto =
    /proyecto\s+de\s+(ley|resolución|decreto)[^.]*?\./gi

  const matches = [...textoContexto.matchAll(patronProyecto)]
  if (matches.length > 0) {
    const ultimoMatch = matches[matches.length - 1][0].trim()
    return ultimoMatch.length > 200 ? ultimoMatch.substring(0, 200) + '...' : ultimoMatch
  }

  // Buscar Carpeta/Repartido
  const patronCarpeta =
    /(?:Carpeta|Repartido)\s+(?:N[°º.]?\s*)?\d+(?:\/\d+)?/gi

  const matchesCarpeta = [...textoContexto.matchAll(patronCarpeta)]
  if (matchesCarpeta.length > 0) {
    return matchesCarpeta[matchesCarpeta.length - 1][0].trim()
  }

  // Fallback: última oración significativa antes de "(Se vota)" o resultado
  const textoLimpio = textoContexto
    .replace(/\(Se vota\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  const oraciones = textoLimpio.split(/[.]\s+/)
  // Buscar la última oración con contenido significativo (más de 10 caracteres)
  for (let i = oraciones.length - 1; i >= 0; i--) {
    const oracion = oraciones[i].trim()
    if (oracion.length > 10) {
      return oracion.length > 200 ? oracion.substring(0, 200) + '...' : oracion
    }
  }

  return 'Votación sin nombre'
}
