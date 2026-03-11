import type { CalidadTituloAsunto } from '@como-voto-uy/shared'
import type { VotacionRepresentantes } from '../scraper/votaciones-representantes.js'
import { convertirNumeroEscrito as convertirNumeroBase } from './extractor-votos.js'
import { canonizarAsunto } from './canonizador-asuntos.js'

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
  calidadTitulo: CalidadTituloAsunto
  carpeta?: string
  repartido?: string
  textoContexto?: string
}

export function extraerVotacionesDiario(textoPdf: string): VotacionDiario[] {
  const votacionesConPos: Array<VotacionDiario & { posicion: number }> = []

  const patronAfirmativosNegativos =
    /——([^—]+?)\s+votos?\s+afirmativos?\s+y\s+([^—]+?)\s+votos?\s+negativos?\s+en\s+([^—]+?):\s*(AFIRMATIVA|NEGATIVA)/gi

  let match: RegExpExecArray | null
  while ((match = patronAfirmativosNegativos.exec(textoPdf)) !== null) {
    const afirmativos = convertirNumero(match[1].trim())
    const negativos = convertirNumero(match[2].trim())
    const total = convertirNumero(match[3].trim())
    const resultado = match[4].toLowerCase() as 'afirmativa' | 'negativa'

    if (afirmativos !== null && negativos !== null && total !== null) {
      const inicio = Math.max(0, match.index - 500)
      votacionesConPos.push({
        afirmativos,
        negativos,
        total,
        resultado,
        textoContexto: textoPdf.substring(inicio, match.index),
        posicion: match.index,
      })
    }
  }

  const patronEnTotal =
    /——([A-Za-záéíóúñüÁÉÍÓÚÑÜ\s]+?)\s+en\s+([A-Za-záéíóúñüÁÉÍÓÚÑÜ\s]+?):\s*(AFIRMATIVA|NEGATIVA)/gi

  while ((match = patronEnTotal.exec(textoPdf)) !== null) {
    if (/votos?\s+afirmativos?/i.test(match[0])) continue

    const afirmativos = convertirNumero(match[1].trim())
    const total = convertirNumero(match[2].trim())
    const resultado = match[3].toLowerCase() as 'afirmativa' | 'negativa'

    if (afirmativos !== null && total !== null) {
      const inicio = Math.max(0, match.index - 500)
      votacionesConPos.push({
        afirmativos,
        negativos: total - afirmativos,
        total,
        resultado,
        textoContexto: textoPdf.substring(inicio, match.index),
        posicion: match.index,
      })
    }
  }

  const patronPorAfirmativa =
    /——([A-Za-záéíóúñüÁÉÍÓÚÑÜ\s]+?)\s+por la afirmativa:\s*(AFIRMATIVA)/gi

  while ((match = patronPorAfirmativa.exec(textoPdf)) !== null) {
    const afirmativos = convertirNumero(match[1].trim())
    if (afirmativos !== null) {
      const inicio = Math.max(0, match.index - 500)
      votacionesConPos.push({
        afirmativos,
        negativos: 0,
        total: afirmativos,
        resultado: 'afirmativa',
        textoContexto: textoPdf.substring(inicio, match.index),
        posicion: match.index,
      })
    }
  }

  votacionesConPos.sort((a, b) => a.posicion - b.posicion)
  return votacionesConPos.map(({ posicion: _, ...votacion }) => votacion)
}

export function matchearVotaciones(
  votacionesJson: VotacionRepresentantes[],
  votacionesDiario: VotacionDiario[],
): VotacionMatcheada[] {
  const resultado: VotacionMatcheada[] = []
  const diarioUsado = new Set<number>()

  for (const votacionJson of votacionesJson) {
    const siVoto = parseInt(votacionJson.SiVoto, 10)
    const noVoto = parseInt(votacionJson.NoVoto, 10)

    const candidatos: number[] = []
    for (let indice = 0; indice < votacionesDiario.length; indice++) {
      if (diarioUsado.has(indice)) continue
      const votacionDiario = votacionesDiario[indice]
      if (votacionDiario.afirmativos === siVoto && votacionDiario.negativos === noVoto) {
        candidatos.push(indice)
      }
    }

    const indiceDiario = candidatos.length > 0 ? candidatos[0] : null
    if (indiceDiario !== null) diarioUsado.add(indiceDiario)

    const informacionAsunto = indiceDiario !== null
      ? extraerNombreProyecto(votacionesDiario[indiceDiario].textoContexto)
      : {
          nombre: `Asunto de sesión ${votacionJson.Sesion} votación ${votacionJson.Votacion}`,
          calidadTitulo: 'incompleto' as const,
          carpeta: undefined,
          repartido: undefined,
        }

    resultado.push({
      sesion: votacionJson.Sesion,
      fecha: votacionJson.SesionFecha,
      votacionNumero: votacionJson.Votacion,
      siVoto,
      noVoto,
      listaSi: votacionJson.Lista_Si,
      listaNo: votacionJson.Lista_No,
      nombreProyecto: informacionAsunto.nombre,
      calidadTitulo: informacionAsunto.calidadTitulo,
      carpeta: informacionAsunto.carpeta,
      repartido: informacionAsunto.repartido,
      textoContexto:
        indiceDiario !== null ? votacionesDiario[indiceDiario].textoContexto : undefined,
    })
  }

  return resultado
}

export function extraerNombreProyecto(textoContexto: string): {
  nombre: string
  calidadTitulo: CalidadTituloAsunto
  carpeta?: string
  repartido?: string
} {
  const carpeta = /(?:Carpeta|Carp\.)\s+(?:N[°º.]?\s*)?(\d+)(?:\/\d+)?/i.exec(textoContexto)?.[1]
  const repartido = /(?:Repartido|Rep\.)\s+(?:N[°º.]?\s*)?(\d+)(?:\/\d+)?/i.exec(textoContexto)?.[1]

  const canonico = canonizarAsunto({
    textoContexto,
    carpeta,
    repartido,
  })

  return {
    nombre: canonico.nombre,
    calidadTitulo: canonico.calidadTitulo,
    carpeta,
    repartido,
  }
}
