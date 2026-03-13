export interface OverrideTituloAsunto {
  codigoOficial?: string
  carpeta?: string
  repartido?: string
  cuerpo?: 'senado' | 'representantes'
  sesionNumero?: number
  ordenSesion?: number
  tituloPublico: string
  nombre?: string
}

export const TITULOS_ASUNTOS_OVERRIDES: OverrideTituloAsunto[] = [
  {
    carpeta: '999999',
    repartido: '888',
    tituloPublico: 'Régimen de transparencia y acceso a datos públicos',
    nombre: 'Régimen de transparencia y acceso a datos públicos',
  },
  {
    cuerpo: 'senado',
    sesionNumero: 53,
    ordenSesion: 4,
    tituloPublico: 'Cooperación y apoyo logístico internacional. (Autorización)',
    nombre: 'Cooperación y apoyo logístico internacional. (Autorización)',
  },
]

function coincideConOverride(
  override: OverrideTituloAsunto,
  input: {
    codigoOficial?: string
    carpeta?: string
    repartido?: string
    cuerpo?: 'senado' | 'representantes'
    sesionNumero?: number
    ordenSesion?: number
  },
): boolean {
  if (override.codigoOficial && input.codigoOficial) {
    return override.codigoOficial === input.codigoOficial
  }

  if (override.carpeta && override.repartido && input.carpeta && input.repartido) {
    return override.carpeta === input.carpeta && override.repartido === input.repartido
  }

  if (override.carpeta && !override.repartido && input.carpeta) {
    return override.carpeta === input.carpeta
  }

  if (
    override.cuerpo &&
    override.sesionNumero != null &&
    override.ordenSesion != null &&
    input.cuerpo &&
    input.sesionNumero != null &&
    input.ordenSesion != null
  ) {
    return (
      override.cuerpo === input.cuerpo &&
      override.sesionNumero === input.sesionNumero &&
      override.ordenSesion === input.ordenSesion
    )
  }

  return false
}

export function obtenerOverrideTituloAsunto(input: {
  codigoOficial?: string
  carpeta?: string
  repartido?: string
  cuerpo?: 'senado' | 'representantes'
  sesionNumero?: number
  ordenSesion?: number
}): OverrideTituloAsunto | null {
  return (
    TITULOS_ASUNTOS_OVERRIDES.find((override) => coincideConOverride(override, input)) ?? null
  )
}
