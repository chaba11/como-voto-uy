const TRATAMIENTOS = /\b(SR|SRA|SRTA|DR|DRA|PROF|ING|ARQ|DON|DOÑA)\b\.?/gi

export function normalizarNombre(nombre: unknown): string {
  return String(nombre ?? '')
    .toUpperCase()
    .replace(TRATAMIENTOS, ' ')
    .replace(/[.;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sinAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ñ/g, 'N')
}

function quitarIniciales(tokens: string[]): string[] {
  return tokens.filter((token) => token.length > 1)
}

function tokenizarClave(clave: string): string[] {
  return clave.split(' ').filter(Boolean)
}

function puntajePorSolapamiento(claveBuscada: string, claveCandidata: string): number {
  const tokensBuscados = tokenizarClave(claveBuscada)
  const tokensCandidatos = tokenizarClave(claveCandidata)

  if (tokensBuscados.length === 0 || tokensCandidatos.length === 0) {
    return 0
  }

  const interseccion = tokensBuscados.filter((token) => tokensCandidatos.includes(token))
  if (interseccion.length === 0) return 0

  const ratioBuscado = interseccion.length / tokensBuscados.length
  const ratioCandidato = interseccion.length / tokensCandidatos.length
  const ratioMinimo = Math.min(ratioBuscado, ratioCandidato)

  if (
    interseccion.length >= 2 &&
    ratioBuscado >= 0.75 &&
    ratioCandidato >= 0.6 &&
    ratioMinimo >= 0.6
  ) {
    return 90
  }

  if (interseccion.length >= 2 && ratioBuscado === 1 && ratioCandidato === 1) {
    return 95
  }

  if (
    interseccion.length === 1 &&
    tokensBuscados.length === 1 &&
    tokensCandidatos.length === 1
  ) {
    return 70
  }

  return 0
}

function descomponerNombre(nombre: string): { tokens: string[]; invertido: string[] } {
  const nombreNormalizado = sinAcentos(normalizarNombre(nombre))
  const partesCrudas = nombreNormalizado
    .replace(/,/g, ' , ')
    .split(/\s+/)
    .filter(Boolean)

  const coma = partesCrudas.indexOf(',')
  if (coma >= 0) {
    const apellido = partesCrudas.slice(0, coma)
    const nombres = partesCrudas.slice(coma + 1)
    const tokens = [...apellido, ...nombres].filter((token) => token !== ',')
    const invertido = [...nombres, ...apellido].filter((token) => token !== ',')
    return { tokens, invertido }
  }

  const tokens = partesCrudas.filter((token) => token !== ',')
  return { tokens, invertido: tokens }
}

export function crearClavesNombre(nombre: string): string[] {
  const { tokens, invertido } = descomponerNombre(nombre)
  const claves = new Set<string>()
  const sinIniciales = quitarIniciales(tokens)
  const invertidoSinIniciales = quitarIniciales(invertido)

  const agregar = (partes: string[]) => {
    const limpio = partes.join(' ').trim()
    if (limpio.length > 0) claves.add(limpio)
  }

  agregar(tokens)
  agregar(invertido)
  agregar(sinIniciales)
  agregar(invertidoSinIniciales)

  if (tokens.length >= 2) {
    agregar(tokens.slice(0, 2))
    agregar(tokens.slice(-2))
    agregar([tokens[0], tokens[tokens.length - 1]])
  }

  if (sinIniciales.length >= 2) {
    agregar(sinIniciales.slice(-2))
    agregar([sinIniciales[0], sinIniciales[sinIniciales.length - 1]])
  }

  if (tokens.length >= 1) {
    agregar([tokens[0]])
    agregar([tokens[tokens.length - 1]])
  }

  return [...claves]
}

function puntuarCoincidencia(nombreBuscado: string, nombreLegislador: string): number {
  const clavesBuscadas = crearClavesNombre(nombreBuscado)
  const clavesLegislador = crearClavesNombre(nombreLegislador)
  const clavesLegisladorSet = new Set(clavesLegislador)

  const clavePrincipalBuscada = clavesBuscadas[0]
  const clavePrincipalLegislador = clavesLegislador[0]

  if (clavePrincipalBuscada && clavePrincipalBuscada === clavePrincipalLegislador) {
    return 100
  }

  for (const clave of clavesBuscadas) {
    if (clavesLegisladorSet.has(clave) && clave.split(' ').length >= 2) {
      return 95
    }
  }

  let mejorPuntajeSolapamiento = 0
  for (const claveBuscada of clavesBuscadas) {
    for (const claveLegislador of clavesLegislador) {
      mejorPuntajeSolapamiento = Math.max(
        mejorPuntajeSolapamiento,
        puntajePorSolapamiento(claveBuscada, claveLegislador),
      )
    }
  }

  if (mejorPuntajeSolapamiento > 0) {
    return mejorPuntajeSolapamiento
  }

  const compactoBuscado = clavePrincipalBuscada ?? ''
  const compactoLegislador = clavePrincipalLegislador ?? ''
  if (
    compactoBuscado.length >= 10 &&
    (compactoLegislador.includes(compactoBuscado) || compactoBuscado.includes(compactoLegislador))
  ) {
    return 60
  }

  return 0
}

export function buscarLegisladorConAlias(
  nombre: string,
  legisladores: { id: number; nombre: string; alias?: string[] | string }[],
): number | null {
  let mejorId: number | null = null
  let mejorPuntaje = 0
  let empate = false

  for (const legislador of legisladores) {
    const aliasCrudo = Array.isArray(legislador.alias)
      ? legislador.alias
      : legislador.alias
        ? [legislador.alias]
        : []
    const alias = aliasCrudo
      .map((valor) => (typeof valor === 'string' ? valor : String(valor ?? '')))
      .filter(Boolean)
    const candidatos = [String(legislador.nombre ?? ''), ...alias]
    const puntaje = Math.max(
      ...candidatos.map((candidato) => puntuarCoincidencia(nombre, candidato)),
    )

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje
      mejorId = legislador.id
      empate = false
    } else if (puntaje > 0 && puntaje === mejorPuntaje) {
      empate = true
    }
  }

  if (mejorPuntaje < 70 || empate) {
    return null
  }

  return mejorId
}

export function buscarLegislador(
  nombre: string,
  legisladores: { id: number; nombre: string }[],
): number | null {
  return buscarLegisladorConAlias(nombre, legisladores)
}
