import type { VotoExtraido, ResultadoAgregado } from './tipos-parser.js'

/**
 * Extrae votos individuales de una sección de votación nominal.
 *
 * Busca patrones como:
 * SEÑORA ASIAÍN.- Voto por la negativa.
 * SEÑOR BATLLE.- Voto por la negativa.
 */
export function extraerVotosNominales(textoSeccion: string): VotoExtraido[] {
  const votos: VotoExtraido[] = []

  const patron =
    /SE[ÑN]OR[A]?\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]*?)\.\s*-+\s*Voto por la (afirmativa|negativa)/gi

  let match: RegExpExecArray | null
  while ((match = patron.exec(textoSeccion)) !== null) {
    const nombreRaw = match[1].trim()
    const votoTexto = match[2].toLowerCase()

    votos.push({
      nombreLegislador: nombreRaw.toUpperCase(),
      voto: votoTexto === 'afirmativa' ? 'afirmativo' : 'negativo',
    })
  }

  return votos
}

/**
 * Extrae el resultado agregado de una votación.
 *
 * Busca patrones como:
 * –19 en 19. Afirmativa. UNANIMIDAD.
 * ‒16 en 19. Afirmativa.
 * –13 en 31. Negativa.
 */
export function extraerResultadoAgregado(textoSeccion: string): ResultadoAgregado | null {
  // Primero intentar con números
  const patronNumeros =
    /[–‒\-]\s*(\d+)\s+en\s+(\d+)[.:]\s*(Afirmativa|Negativa)\.?\s*(UNANIMIDAD)?/i

  const matchNumeros = patronNumeros.exec(textoSeccion)
  if (matchNumeros) {
    return {
      afirmativos: parseInt(matchNumeros[1], 10),
      total: parseInt(matchNumeros[2], 10),
      resultado: matchNumeros[3].toLowerCase() as 'afirmativa' | 'negativa',
      unanimidad: !!matchNumeros[4],
    }
  }

  // Intentar con números escritos en palabras
  const patronPalabras =
    /[–‒\-]?\s*([A-Za-záéíóúñü][a-záéíóúñü\s]+?)\s+en\s+([A-Za-záéíóúñü][a-záéíóúñü\s]+?)[.:]\s*(AFIRMATIVA|NEGATIVA|Afirmativa|Negativa)/i

  const matchPalabras = patronPalabras.exec(textoSeccion)
  if (matchPalabras) {
    const afirmativos = convertirNumeroEscrito(matchPalabras[1].trim().toLowerCase())
    const total = convertirNumeroEscrito(matchPalabras[2].trim().toLowerCase())

    if (afirmativos !== null && total !== null) {
      const unanimidad = /UNANIMIDAD/i.test(textoSeccion)
      return {
        afirmativos,
        total,
        resultado: matchPalabras[3].toLowerCase() as 'afirmativa' | 'negativa',
        unanimidad,
      }
    }
  }

  return null
}

// Mapa de números escritos en español
const UNIDADES: Record<string, number> = {
  cero: 0,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciséis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiuna: 21,
  veintidós: 22,
  veintitrés: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiséis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
}

const DECENAS: Record<string, number> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
}

/**
 * Convierte un número escrito en español a su valor numérico.
 * Ej: "sesenta y dos" -> 62
 */
export function convertirNumeroEscrito(texto: string): number | null {
  const textoLimpio = texto.trim().toLowerCase()

  // Buscar en unidades directas (0-29)
  if (UNIDADES[textoLimpio] !== undefined) {
    return UNIDADES[textoLimpio]
  }

  // Buscar en decenas exactas
  if (DECENAS[textoLimpio] !== undefined) {
    return DECENAS[textoLimpio]
  }

  // Patrón "decena y unidad" (ej: "sesenta y dos")
  const partes = textoLimpio.split(/\s+y\s+/)
  if (partes.length === 2) {
    const decena = DECENAS[partes[0].trim()]
    const unidad = UNIDADES[partes[1].trim()]
    if (decena !== undefined && unidad !== undefined) {
      return decena + unidad
    }
  }

  return null
}
