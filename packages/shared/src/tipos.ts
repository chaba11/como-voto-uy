export type Camara = 'senado' | 'representantes'

export type TipoVoto = 'afirmativo' | 'negativo' | 'ausente'

export interface LegisladorConPartido {
  id: number
  nombre: string
  camara: Camara
  departamento: string | null
  partido: {
    id: number
    nombre: string
    sigla: string
    color: string
  }
  titularId: number | null
}

export interface VotoConDetalle {
  id: number
  voto: TipoVoto
  legislador: LegisladorConPartido
  proyectoLey: {
    id: number
    nombre: string
  }
}

export interface ResumenVotacion {
  proyectoLeyId: number
  nombre: string
  fecha: string
  camara: Camara
  afirmativos: number
  negativos: number
  ausentes: number
}

export interface EstadisticasLegislador {
  legisladorId: number
  totalVotos: number
  afirmativos: number
  negativos: number
  ausentes: number
  porcentajeAsistencia: number
  alineamientoPartidario: number
}
