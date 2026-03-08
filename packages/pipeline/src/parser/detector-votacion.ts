export interface SeccionVotacion {
  tipo: 'nominal' | 'agregada'
  texto: string
  inicio: number
  fin: number
}

/**
 * Detecta todas las secciones de votación en el texto de una taquigráfica.
 *
 * Busca dos tipos de votaciones:
 * 1. Agregadas: "(Se vota)" seguido de "–N en N. Afirmativa/Negativa"
 * 2. Nominales: "votación nominal" / "nominativamente" seguido de votos individuales
 */
export function detectarVotaciones(texto: string): SeccionVotacion[] {
  const secciones: SeccionVotacion[] = []

  // Detectar votaciones nominales
  detectarNominales(texto, secciones)

  // Detectar votaciones agregadas
  detectarAgregadas(texto, secciones)

  // Ordenar por posición en el texto
  secciones.sort((a, b) => a.inicio - b.inicio)

  // Eliminar duplicados (una nominal puede contener un resultado agregado)
  return eliminarSolapamientos(secciones)
}

function detectarNominales(texto: string, secciones: SeccionVotacion[]): void {
  // Buscar indicadores de votación nominal
  const indicadoresNominal = /(?:votaci[oó]n\s+nominal|nominativamente|nominativo|T[oó]mese\s+la\s+votaci[oó]n\s+nominal)/gi

  let match: RegExpExecArray | null
  while ((match = indicadoresNominal.exec(texto)) !== null) {
    const inicioContexto = Math.max(0, match.index - 200)

    // Buscar los votos individuales después del indicador
    const textoDesdeIndicador = texto.slice(match.index)
    const votosIndividuales = /SE[ÑN]OR[A]?\s+[A-ZÁÉÍÓÚÑ\s]+?\.\s*-+\s*Voto por la (?:afirmativa|negativa)/gi

    let ultimoVoto: RegExpExecArray | null = null
    let primerVoto: RegExpExecArray | null = null
    let votoMatch: RegExpExecArray | null

    // Resetear el regex
    votosIndividuales.lastIndex = 0
    while ((votoMatch = votosIndividuales.exec(textoDesdeIndicador)) !== null) {
      if (!primerVoto) primerVoto = votoMatch
      ultimoVoto = votoMatch
      // No buscar votos más allá de 5000 caracteres del indicador
      if (votoMatch.index > 5000) break
    }

    if (primerVoto && ultimoVoto) {
      const finSeccion = match.index + ultimoVoto.index + ultimoVoto[0].length + 200
      const fin = Math.min(texto.length, finSeccion)

      secciones.push({
        tipo: 'nominal',
        texto: texto.slice(inicioContexto, fin),
        inicio: inicioContexto,
        fin,
      })
    }
  }
}

function detectarAgregadas(texto: string, secciones: SeccionVotacion[]): void {
  // Patrón para resultado agregado: –N en N. Afirmativa/Negativa. [UNANIMIDAD.]
  // Los guiones pueden ser –, ‒, o -
  const patronResultado =
    /[–‒\-]\s*(\d+)\s+en\s+(\d+)[.:]\s*(Afirmativa|Negativa)\.?\s*(UNANIMIDAD)?/gi

  let match: RegExpExecArray | null
  while ((match = patronResultado.exec(texto)) !== null) {
    // Tomar contexto alrededor del resultado
    const inicioContexto = Math.max(0, match.index - 500)
    const finContexto = Math.min(texto.length, match.index + match[0].length + 100)

    secciones.push({
      tipo: 'agregada',
      texto: texto.slice(inicioContexto, finContexto),
      inicio: inicioContexto,
      fin: finContexto,
    })
  }
}

function eliminarSolapamientos(secciones: SeccionVotacion[]): SeccionVotacion[] {
  if (secciones.length <= 1) return secciones

  const resultado: SeccionVotacion[] = []

  for (const seccion of secciones) {
    // Si esta sección está contenida en una nominal ya agregada, omitirla
    const contenidaEnNominal = resultado.some(
      (r) => r.tipo === 'nominal' && seccion.tipo === 'agregada' && seccion.inicio >= r.inicio && seccion.fin <= r.fin
    )

    if (!contenidaEnNominal) {
      resultado.push(seccion)
    }
  }

  return resultado
}
