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
  // Estrategia 1: Buscar indicadores de votación nominal seguidos de votos
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

  // Estrategia 2: Detectar bloques de votos individuales consecutivos sin keyword previa.
  // Busca 3+ votos individuales seguidos (separados por poco texto).
  const votoPattern = /SE[ÑN]OR[A]?\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]*?\.\s*-+\s*Voto por la (?:afirmativa|negativa)/gi
  const todosLosVotos: { index: number; length: number }[] = []
  let vm: RegExpExecArray | null
  while ((vm = votoPattern.exec(texto)) !== null) {
    todosLosVotos.push({ index: vm.index, length: vm[0].length })
  }

  // Agrupar votos consecutivos (máximo 200 chars entre ellos)
  let bloqueInicio = -1
  let bloqueFin = -1
  let bloqueCount = 0

  for (let i = 0; i < todosLosVotos.length; i++) {
    const voto = todosLosVotos[i]
    if (bloqueInicio === -1) {
      bloqueInicio = voto.index
      bloqueFin = voto.index + voto.length
      bloqueCount = 1
      continue
    }

    const distancia = voto.index - bloqueFin
    if (distancia <= 200) {
      bloqueFin = voto.index + voto.length
      bloqueCount++
    } else {
      // Cerrar bloque anterior si tiene 3+ votos
      if (bloqueCount >= 3) {
        agregarBloqueNominalSiNuevo(texto, secciones, bloqueInicio, bloqueFin)
      }
      bloqueInicio = voto.index
      bloqueFin = voto.index + voto.length
      bloqueCount = 1
    }
  }
  // Cerrar último bloque
  if (bloqueCount >= 3) {
    agregarBloqueNominalSiNuevo(texto, secciones, bloqueInicio, bloqueFin)
  }
}

function agregarBloqueNominalSiNuevo(
  texto: string,
  secciones: SeccionVotacion[],
  bloqueInicio: number,
  bloqueFin: number,
): void {
  const inicio = Math.max(0, bloqueInicio - 500)
  const fin = Math.min(texto.length, bloqueFin + 200)

  // No agregar si ya hay una sección nominal que cubre este rango
  const yaCubierto = secciones.some(
    (s) => s.tipo === 'nominal' && s.inicio <= bloqueInicio && s.fin >= bloqueFin,
  )
  if (!yaCubierto) {
    secciones.push({
      tipo: 'nominal',
      texto: texto.slice(inicio, fin),
      inicio,
      fin,
    })
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
