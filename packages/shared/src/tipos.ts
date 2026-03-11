export type Camara = 'senado' | 'representantes'

export type CuerpoLegislativo =
  | 'senado'
  | 'representantes'
  | 'asamblea_general'
  | 'comision_permanente'

export type ModalidadVotacion =
  | 'nominal'
  | 'electronica'
  | 'ordinaria'
  | 'secreta'
  | 'desconocida'

export type NivelConfianzaVoto = 'confirmado' | 'alto' | 'medio' | 'bajo'

export type EstadoCoberturaVotacion =
  | 'individual_confirmado'
  | 'individual_inferido'
  | 'agregado'
  | 'sin_desglose_publico'
  | 'secreto'

export type TipoVoto =
  | 'afirmativo'
  | 'negativo'
  | 'abstencion'
  | 'ausente'
  | 'sin_emitir'

export type ResultadoVotacion = 'afirmativa' | 'negativa'

export type TipoFuente =
  | 'json'
  | 'diario_pdf'
  | 'taquigrafica_html'
  | 'dataset'
  | 'audio'
  | 'video'
  | 'manual'

export type TipoEvidencia = 'texto' | 'timestamp' | 'ocr' | 'nota'

export type CalidadTituloAsunto = 'canonico' | 'razonable' | 'incompleto'

export type OrigenPartidoLegislador = 'seed' | 'padron' | 'inferido' | 'sin_asignar'

export interface LegisladorConPartido {
  id: number
  nombre: string
  legislaturaId: number
  camara: Camara
  departamento: string | null
  origenPartido: OrigenPartidoLegislador
  partido: {
    id: number
    nombre: string
    sigla: string
    color: string
  }
  titularId: number | null
}

export interface ResumenAsunto {
  id: number
  nombre: string
  calidadTitulo: CalidadTituloAsunto
  descripcion: string | null
  tema: string | null
  codigoOficial: string | null
  numeroLey: string | null
}

export interface FuenteResumen {
  id: number
  tipo: TipoFuente
  url: string
}

export interface EvidenciaResumen {
  id: number
  tipo: TipoEvidencia
  texto: string | null
  timestampInicio: number | null
  timestampFin: number | null
}

export interface VotoIndividualConEvidencia {
  id: number
  voto: TipoVoto
  nivelConfianza: Exclude<NivelConfianzaVoto, 'bajo'>
  esOficial: boolean
  legislador: LegisladorConPartido
  fuente: FuenteResumen | null
  evidencias: EvidenciaResumen[]
}

export interface VotacionConFuente {
  id: number
  cuerpo: CuerpoLegislativo
  fecha: string
  sesionNumero: number | null
  ordenSesion: number | null
  modalidad: ModalidadVotacion
  estadoCobertura: EstadoCoberturaVotacion
  nivelConfianza: NivelConfianzaVoto
  esOficial: boolean
  resultado: ResultadoVotacion | null
  afirmativos: number | null
  negativos: number | null
  abstenciones: number | null
  totalPresentes: number | null
  unanimidad: boolean | null
  fuente: FuenteResumen | null
  votosIndividuales: VotoIndividualConEvidencia[]
}

export interface AsuntoConVotaciones extends ResumenAsunto {
  votaciones: VotacionConFuente[]
}

export interface EstadisticasLegislador {
  legisladorId: number
  totalVotosPublicos: number
  confirmados: number
  inferidos: number
  afirmativos: number
  negativos: number
  abstenciones: number
  ausentes: number
  porcentajeCobertura: number
  porcentajeAsistencia: number
}
