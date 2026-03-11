export interface VotacionExtraida {
  tipo: 'nominal' | 'agregada'
  textoContexto: string // surrounding text for reference
  proyecto?: ProyectoExtraido
  votos: VotoExtraido[] // empty for aggregate
  resultado?: ResultadoAgregado
}

export interface VotoExtraido {
  nombreLegislador: string // as found in text (uppercase, last name)
  voto: 'afirmativo' | 'negativo'
}

export interface ResultadoAgregado {
  afirmativos: number
  total: number
  resultado: 'afirmativa' | 'negativa'
  unanimidad: boolean
}

export interface ProyectoExtraido {
  nombre?: string
  carpeta?: string
  repartido?: string
  tipoAsunto?: string
}

export interface ResultadoParseo {
  sesionTexto: string
  votaciones: VotacionExtraida[]
  asistentes: string[]
  ausentes: string[]
}
