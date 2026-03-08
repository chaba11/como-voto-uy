import type { Camara } from './tipos.js'

export interface InfoLegislatura {
  numero: number
  fechaInicio: string
  fechaFin: string | null
}

export const LEGISLATURAS: InfoLegislatura[] = [
  { numero: 45, fechaInicio: '2000-02-15', fechaFin: '2005-02-14' },
  { numero: 46, fechaInicio: '2005-02-15', fechaFin: '2010-02-14' },
  { numero: 47, fechaInicio: '2010-02-15', fechaFin: '2015-02-14' },
  { numero: 48, fechaInicio: '2015-02-15', fechaFin: '2020-02-14' },
  { numero: 49, fechaInicio: '2020-02-15', fechaFin: '2025-02-14' },
  { numero: 50, fechaInicio: '2025-02-15', fechaFin: null },
]

export const BASE_URL_PARLAMENTO = 'https://parlamento.gub.uy'

export const URLS_TAQUIGRAFICAS: Record<Camara, string> = {
  senado: `${BASE_URL_PARLAMENTO}/camarasycomisiones/senadores/plenario/documentos/diarios-de-sesion`,
  representantes: `${BASE_URL_PARLAMENTO}/camarasycomisiones/representantes/plenario/documentos/diarios-de-sesion`,
}

export const MIEMBROS_POR_CAMARA: Record<Camara, number> = {
  senado: 31,
  representantes: 99,
}
