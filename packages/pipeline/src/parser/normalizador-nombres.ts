/**
 * Normaliza un nombre de legislador para comparación.
 *
 * - Convierte a mayúsculas
 * - Elimina espacios extra
 * - Manejo de abreviaciones comunes en taquigráficas
 */
export function normalizarNombre(nombre: string): string {
  return nombre
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Elimina acentos/diacríticos de un texto para comparación.
 */
export function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Busca un legislador en una lista por nombre fuzzy.
 *
 * Estrategia de búsqueda:
 * 1. Coincidencia exacta (sin acentos, mayúsculas)
 * 2. Coincidencia por apellido (el nombre en taquigráfica suele ser solo apellido)
 * 3. Coincidencia parcial (el apellido del texto está contenido en el nombre completo)
 *
 * @returns El id del legislador encontrado, o null si no hay coincidencia
 */
export function buscarLegislador(
  nombre: string,
  legisladores: { id: number; nombre: string }[]
): number | null {
  const nombreNormalizado = sinAcentos(normalizarNombre(nombre))

  // 1. Coincidencia exacta (sin acentos)
  for (const leg of legisladores) {
    const legNormalizado = sinAcentos(normalizarNombre(leg.nombre))
    if (legNormalizado === nombreNormalizado) {
      return leg.id
    }
  }

  // 2. El nombre buscado es un apellido que coincide con el apellido del legislador
  for (const leg of legisladores) {
    const legNormalizado = sinAcentos(normalizarNombre(leg.nombre))
    const partesLeg = legNormalizado.split(' ')

    // El apellido en taquigráfica puede ser el último o los últimos del nombre completo
    // Ej: "MANINI RÍOS" -> buscar "MANINI RIOS" en "GUIDO MANINI RIOS"
    if (partesLeg.length > 1) {
      // Intentar con último apellido
      const ultimoApellido = partesLeg[partesLeg.length - 1]
      if (ultimoApellido === nombreNormalizado) {
        return leg.id
      }

      // Intentar con últimos dos componentes (apellido compuesto)
      if (partesLeg.length > 2) {
        const apellidoCompuesto = partesLeg.slice(-2).join(' ')
        if (apellidoCompuesto === nombreNormalizado) {
          return leg.id
        }
      }
    }
  }

  // 3. Coincidencia parcial: el nombre buscado está contenido en el nombre del legislador
  for (const leg of legisladores) {
    const legNormalizado = sinAcentos(normalizarNombre(leg.nombre))
    if (legNormalizado.includes(nombreNormalizado)) {
      return leg.id
    }
  }

  // 4. Coincidencia inversa: el nombre del legislador contiene el buscado
  for (const leg of legisladores) {
    const legNormalizado = sinAcentos(normalizarNombre(leg.nombre))
    if (nombreNormalizado.includes(legNormalizado)) {
      return leg.id
    }
  }

  return null
}
