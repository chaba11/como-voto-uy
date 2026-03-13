import type {
  CalidadTituloAsunto,
  OrigenTituloAsunto,
} from '@como-voto-uy/shared'
import type { VotacionRepresentantes } from '../scraper/votaciones-representantes.js'
import { convertirNumeroEscrito as convertirNumeroBase } from './extractor-votos.js'
import { canonizarAsunto } from './canonizador-asuntos.js'

function convertirNumero(texto: string): number | null {
  const limpio = texto
    .trim()
    .toLowerCase()
    .replace(/\bpresentes?\b/g, '')
    .replace(/\bmiembros?\b/g, '')
    .replace(/\bvotos?\b/g, '')
    .replace(/\bafirmativos?\b/g, '')
    .replace(/\bnegativos?\b/g, '')
    .replace(/[()".,:;]+/g, ' ')
    .replace(/\bnovena\s+y\b/g, 'noventa y')
    .replace(/\s+/g, ' ')
    .trim()
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
  tituloPublico: string
  origenTitulo: OrigenTituloAsunto
  calidadTitulo: CalidadTituloAsunto
  carpeta?: string
  repartido?: string
  textoContexto?: string
}

function extraerContextoRelevante(textoPdf: string, indice: number): string {
  const inicioVentana = Math.max(0, indice - 12000)
  const ventana = textoPdf.substring(inicioVentana, indice)
  const marcadoresEncabezado = [
    /asunto\s+relativo\s+a:/gi,
    /\d+\.-\s+[^\n]{10,250}/g,
  ]
  const marcadoresIdentificador = [
    /carp(?:eta|\.)\s+(?:n[\u00b0\u00ba.]?\s*)?\d+/gi,
    /rep(?:artido|\.)\s+(?:n[\u00b0\u00ba.]?\s*)?\d+/gi,
  ]
  const marcadoresFuertes = [
    /proyecto\s+de\s+ley/gi,
    /proyecto\s+de\s+resoluci(?:o|\u00f3)n/gi,
    /proyecto\s+de\s+minuta\s+de\s+comunicaci(?:o|\u00f3)n/gi,
    /mensaje\s+del\s+poder\s+ejecutivo/gi,
    /l[ée]ase\s+el\s+proyecto/gi,
  ]
  const marcadoresDebiles = [/se\s+pasa\s+a\s+considerar/gi, /corresponde\s+votar/gi]

  let inicioRelativo = 0
  for (const patron of marcadoresEncabezado) {
    let match: RegExpExecArray | null
    while ((match = patron.exec(ventana)) !== null) {
      inicioRelativo = Math.max(inicioRelativo, match.index)
    }
  }

  if (inicioRelativo === 0) {
    for (const patron of marcadoresIdentificador) {
      let match: RegExpExecArray | null
      while ((match = patron.exec(ventana)) !== null) {
        inicioRelativo = Math.max(inicioRelativo, match.index)
      }
    }
  }

  if (inicioRelativo === 0) {
    for (const patron of marcadoresFuertes) {
      let match: RegExpExecArray | null
      while ((match = patron.exec(ventana)) !== null) {
        inicioRelativo = Math.max(inicioRelativo, match.index)
      }
    }
  }

  if (inicioRelativo === 0) {
    for (const patron of marcadoresDebiles) {
      let match: RegExpExecArray | null
      while ((match = patron.exec(ventana)) !== null) {
        inicioRelativo = Math.max(inicioRelativo, match.index)
      }
    }
  }

  const contexto = ventana.substring(inicioRelativo).trim()
  if (contexto.length > 0) return contexto
  return ventana.slice(-900).trim()
}

function puntuarInformacionAsunto(
  info: {
    tituloPublico: string
    origenTitulo: OrigenTituloAsunto
    calidadTitulo: CalidadTituloAsunto
    carpeta?: string
    repartido?: string
  },
  textoContexto: string,
  indice: number,
): number {
  const baseCalidad = {
    canonico: 300,
    razonable: 200,
    incompleto: 100,
  }[info.calidadTitulo]

  const baseOrigen = {
    override_manual: 40,
    estructurado: 30,
    contexto: 20,
    identificador: 10,
  }[info.origenTitulo]

  const bonusContexto =
    (/asunto\s+relativo\s+a:/i.test(textoContexto) ? 80 : 0) +
    (/\d+\.-\s+/i.test(textoContexto) ? 50 : 0) +
    (/proyecto\s+de\s+ley/i.test(textoContexto) ? 20 : 0) +
    (/carp(?:eta|\.)/i.test(textoContexto) ? 15 : 0) +
    (/rep(?:artido|\.)/i.test(textoContexto) ? 15 : 0) +
    (/gracias,\s+señor[ae]?\s+president/i.test(textoContexto) ? -80 : 0)

  return baseCalidad + baseOrigen + bonusContexto - indice
}

export function extraerVotacionesDiario(textoPdf: string): VotacionDiario[] {
  const votacionesConPos: Array<VotacionDiario & { posicion: number }> = []

  const patronAfirmativosNegativos =
    /(?:\u2014\u2014|Ã¢â‚¬â€Ã¢â‚¬â€)([^\u2014]+?)\s+votos?\s+afirmativos?\s+y\s+([^\u2014]+?)\s+votos?\s+negativos?\s+en\s+([^\u2014]+?):\s*(AFIRMATIVA|NEGATIVA)/gi

  let match: RegExpExecArray | null
  while ((match = patronAfirmativosNegativos.exec(textoPdf)) !== null) {
    const afirmativos = convertirNumero(match[1].trim())
    const negativos = convertirNumero(match[2].trim())
    const total = convertirNumero(match[3].trim())
    const resultado = match[4].toLowerCase() as 'afirmativa' | 'negativa'

    if (afirmativos !== null && negativos !== null && total !== null) {
      votacionesConPos.push({
        afirmativos,
        negativos,
        total,
        resultado,
        textoContexto: extraerContextoRelevante(textoPdf, match.index),
        posicion: match.index,
      })
    }
  }

  const patronEnTotal =
    /(?:\u2014\u2014|Ã¢â‚¬â€Ã¢â‚¬â€)([\p{L}\s]+?)\s+en\s+([\p{L}\s]+?):\s*(AFIRMATIVA|NEGATIVA)/giu

  while ((match = patronEnTotal.exec(textoPdf)) !== null) {
    if (/votos?\s+afirmativos?/i.test(match[0])) continue

    const afirmativos = convertirNumero(match[1].trim())
    const total = convertirNumero(match[2].trim())
    const resultado = match[3].toLowerCase() as 'afirmativa' | 'negativa'

    if (afirmativos !== null && total !== null) {
      votacionesConPos.push({
        afirmativos,
        negativos: total - afirmativos,
        total,
        resultado,
        textoContexto: extraerContextoRelevante(textoPdf, match.index),
        posicion: match.index,
      })
    }
  }

  const patronPorAfirmativa =
    /(?:\u2014\u2014|Ã¢â‚¬â€Ã¢â‚¬â€)([\p{L}\s]+?)\s+por la afirmativa:\s*(AFIRMATIVA)/giu

  while ((match = patronPorAfirmativa.exec(textoPdf)) !== null) {
    const afirmativos = convertirNumero(match[1].trim())
    if (afirmativos !== null) {
      votacionesConPos.push({
        afirmativos,
        negativos: 0,
        total: afirmativos,
        resultado: 'afirmativa',
        textoContexto: extraerContextoRelevante(textoPdf, match.index),
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

    const indiceDiario =
      candidatos.length > 0
        ? candidatos
            .map((indice) => ({
              indice,
              informacionAsunto: extraerNombreProyecto(votacionesDiario[indice].textoContexto),
              textoContexto: votacionesDiario[indice].textoContexto,
            }))
            .map((candidato) => ({
              ...candidato,
              puntaje: puntuarInformacionAsunto(
                candidato.informacionAsunto,
                candidato.textoContexto,
                candidato.indice,
              ),
            }))
            .sort((a, b) => b.puntaje - a.puntaje)[0]?.indice ?? null
        : null

    if (indiceDiario !== null) diarioUsado.add(indiceDiario)

    const informacionAsunto =
      indiceDiario !== null
        ? extraerNombreProyecto(votacionesDiario[indiceDiario].textoContexto)
        : extraerNombreProyecto('')

    resultado.push({
      sesion: votacionJson.Sesion,
      fecha: votacionJson.SesionFecha,
      votacionNumero: votacionJson.Votacion,
      siVoto,
      noVoto,
      listaSi: votacionJson.Lista_Si,
      listaNo: votacionJson.Lista_No,
      nombreProyecto: informacionAsunto.nombre,
      tituloPublico: informacionAsunto.tituloPublico,
      origenTitulo: informacionAsunto.origenTitulo,
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
  tituloPublico: string
  origenTitulo: OrigenTituloAsunto
  calidadTitulo: CalidadTituloAsunto
  carpeta?: string
  repartido?: string
} {
  const carpeta =
    /(?:Carpeta|Carp\.)\s+(?:N[\u00b0\u00ba.]?\s*)?(\d+)(?:\/\d+)?/i.exec(textoContexto)?.[1]
  const repartido =
    /(?:Repartido|Rep\.)\s+(?:N[\u00b0\u00ba.]?\s*)?(\d+)(?:\/\d+)?/i.exec(textoContexto)?.[1]

  const canonico = canonizarAsunto({
    textoContexto,
    carpeta,
    repartido,
  })

  return {
    nombre: canonico.nombre,
    tituloPublico: canonico.tituloPublico,
    origenTitulo: canonico.origenTitulo,
    calidadTitulo: canonico.calidadTitulo,
    carpeta,
    repartido,
  }
}
