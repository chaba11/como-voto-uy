const TRATAMIENTOS = /\b(SR|SRA|SRTA|DR|DRA|PROF|ING|ARQ|DON|DOÑA)\b\.?/gi

export function normalizarNombre(nombre: string): string {
  return nombre
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
  const clavesLegislador = new Set(crearClavesNombre(nombreLegislador))

  const clavePrincipalBuscada = clavesBuscadas[0]
  const clavePrincipalLegislador = crearClavesNombre(nombreLegislador)[0]

  if (clavePrincipalBuscada && clavePrincipalBuscada === clavePrincipalLegislador) {
    return 100
  }

  for (const clave of clavesBuscadas) {
    if (clavesLegislador.has(clave) && clave.split(' ').length >= 2) {
      return 95
    }
  }

  const tokensBuscados = clavePrincipalBuscada?.split(' ') ?? []
  const tokensLegislador = clavePrincipalLegislador?.split(' ') ?? []
  const interseccion = tokensBuscados.filter((token) => tokensLegislador.includes(token))

  if (interseccion.length >= Math.min(2, tokensBuscados.length) && interseccion.length >= 2) {
    return 85
  }

  const apellidoBuscado = clavesBuscadas.find((clave) => clave.split(' ').length <= 2)
  if (
    apellidoBuscado &&
    [...clavesLegislador].some(
      (clave) => clave === apellidoBuscado && apellidoBuscado.split(' ').length >= 1,
    )
  ) {
    return apellidoBuscado.split(' ').length === 2 ? 80 : 70
  }

  const compactoBuscado = clavePrincipalBuscada ?? ''
  const compactoLegislador = clavePrincipalLegislador ?? ''
  if (
    compactoBuscado.length >= 8 &&
    (compactoLegislador.includes(compactoBuscado) || compactoBuscado.includes(compactoLegislador))
  ) {
    return 60
  }

  return 0
}

export function buscarLegislador(
  nombre: string,
  legisladores: { id: number; nombre: string }[],
): number | null {
  let mejorId: number | null = null
  let mejorPuntaje = 0
  let empate = false

  for (const legislador of legisladores) {
    const puntaje = puntuarCoincidencia(nombre, legislador.nombre)
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
