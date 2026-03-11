import type { CalidadTituloAsunto } from '@como-voto-uy/shared'

export interface DatosCanonizadosAsunto {
  nombre: string
  calidadTitulo: CalidadTituloAsunto
  descripcion?: string
  tipoAsunto?: string
}

function limpiarEspacios(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}

function quitarPrefijosSesion(texto: string): string {
  return texto
    .replace(/^\(?\s*se (?:pasa a considerar|considera|somete a votación|somete a consideración)\s+/i, '')
    .replace(/^corresponde votar\s+/i, '')
    .replace(/^ahora (?:consideramos|pasamos a considerar)\s+/i, '')
    .replace(/^se va a votar[:,]?\s*/i, '')
    .replace(/^\(?se vota\)?[:,]?\s*/i, '')
}

function limpiarRuidoParlamentario(texto: string): string {
  return limpiarEspacios(
    texto
      .replace(/\(Se vota\)/gi, ' ')
      .replace(/\bCarp(?:eta|\.)\s+N[.°ºo ]*\s*\d+(?:\/\d+)?/gi, ' ')
      .replace(/\bRep(?:artido|\.)\s+N[.°ºo ]*\s*\d+(?:\/\d+)?/gi, ' ')
      .replace(/[—–-]{2,}.+$/g, ' ')
      .replace(/\b(?:afirmativa|negativa)\b\.?/gi, ' ')
      .replace(/\b(?:unanimidad|se aprueba|se levanta la sesión)\b\.?/gi, ' ')
      .replace(/[.]\s*$/, ''),
  )
}

function recortarTitulo(texto: string, max = 180): string {
  if (texto.length <= max) return texto
  return `${texto.slice(0, max).trimEnd()}…`
}

function capitalizarTitulo(texto: string): string {
  if (!texto) return texto
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function tituloDesdeFormulaProyecto(texto: string): { nombre: string; tipoAsunto?: string } | null {
  const textoLimpio = quitarPrefijosSesion(texto)
  const patrones: Array<{ patron: RegExp; tipo: string }> = [
    {
      patron:
        /proyecto\s+de\s+ley\s+(?:por\s+el|por\s+la|por\s+los|por\s+las)\s+(?:cual|que)\s+se\s+(.+?)(?:[.;]|$)/i,
      tipo: 'proyecto_ley',
    },
    {
      patron:
        /proyecto\s+de\s+ley\s+(?:sobre|relativo a|referente a)\s+(.+?)(?:[.;]|$)/i,
      tipo: 'proyecto_ley',
    },
    {
      patron: /proyecto\s+de\s+ley\s+(.+?)(?:[.;]|$)/i,
      tipo: 'proyecto_ley',
    },
    {
      patron:
        /proyecto\s+de\s+resoluci[oó]n\s+(?:sobre|relativo a|referente a)\s+(.+?)(?:[.;]|$)/i,
      tipo: 'proyecto_resolucion',
    },
    {
      patron: /proyecto\s+de\s+resoluci[oó]n\s+(.+?)(?:[.;]|$)/i,
      tipo: 'proyecto_resolucion',
    },
    {
      patron:
        /proyecto\s+de\s+minuta\s+de\s+comunicaci[oó]n\s+(?:por\s+el|por\s+la)\s+(?:cual|que)\s+se\s+(.+?)(?:[.;]|$)/i,
      tipo: 'minuta_comunicacion',
    },
    {
      patron:
        /mensaje\s+del\s+poder\s+ejecutivo\s+(?:relativo a|sobre)\s+(.+?)(?:[.;]|$)/i,
      tipo: 'mensaje_poder_ejecutivo',
    },
  ]

  for (const { patron, tipo } of patrones) {
    const match = patron.exec(textoLimpio)
    if (!match?.[1]) continue

    let nombre = limpiarRuidoParlamentario(match[1])
    nombre = nombre.replace(/^(sobre|relativo a|referente a)\s+/i, '')
    nombre = nombre.replace(/^(la|el|los|las)\s+/i, '')
    nombre = capitalizarTitulo(nombre)

    if (nombre.length < 8) continue

    return {
      nombre: recortarTitulo(nombre),
      tipoAsunto: tipo,
    }
  }

  return null
}

function tituloDesdeContexto(texto: string): string | null {
  const limpio = limpiarRuidoParlamentario(quitarPrefijosSesion(texto))
  const oraciones = limpio
    .split(/[.;]\s+/)
    .map((oracion) => limpiarEspacios(quitarPrefijosSesion(oracion)))
    .filter((oracion) => oracion.length >= 12)

  for (let indice = oraciones.length - 1; indice >= 0; indice--) {
    const oracion = oraciones[indice]
    const desdeProyecto = tituloDesdeFormulaProyecto(oracion)
    if (desdeProyecto) {
      return recortarTitulo(desdeProyecto.nombre)
    }

    if (/^(se|corresponde|votaci[oó]n|carpeta|repartido)\b/i.test(oracion)) continue
    const candidata = oracion
      .replace(/^(primer|primera|segundo|segunda|tercer|tercera)\s+/i, '')
      .replace(/^proyecto\s+de\s+(?:ley|resoluci[oó]n|decreto|minuta\s+de\s+comunicaci[oó]n)\s+/i, '')
      .replace(/^(sobre|relativo a|referente a)\s+/i, '')
      .replace(/^(la|el|los|las)\s+/i, '')

    return recortarTitulo(capitalizarTitulo(candidata))
  }

  return null
}

function descripcionDesdeMetadatos(carpeta?: string, repartido?: string): string | undefined {
  const partes = []
  if (carpeta) partes.push(`Carpeta n.º ${carpeta}`)
  if (repartido) partes.push(`Repartido n.º ${repartido}`)
  return partes.length > 0 ? partes.join(' · ') : undefined
}

export function canonizarAsunto(input: {
  nombreCrudo?: string
  textoContexto?: string
  carpeta?: string
  repartido?: string
  tipoAsunto?: string
}): DatosCanonizadosAsunto {
  const candidatos = [input.nombreCrudo, input.textoContexto].filter(
    (valor): valor is string => !!valor?.trim(),
  )

  for (const candidato of candidatos) {
    const desdeProyecto = tituloDesdeFormulaProyecto(candidato)
    if (desdeProyecto) {
      return {
        nombre: desdeProyecto.nombre,
        calidadTitulo: 'canonico',
        descripcion: descripcionDesdeMetadatos(input.carpeta, input.repartido),
        tipoAsunto: input.tipoAsunto ?? desdeProyecto.tipoAsunto,
      }
    }
  }

  const contexto = candidatos
    .map((candidato) => tituloDesdeContexto(candidato))
    .find((valor): valor is string => !!valor)

  if (contexto) {
    return {
      nombre: contexto,
      calidadTitulo: input.carpeta || input.repartido ? 'razonable' : 'incompleto',
      descripcion: descripcionDesdeMetadatos(input.carpeta, input.repartido),
      tipoAsunto: input.tipoAsunto,
    }
  }

  const identificador = [input.carpeta ? `Carpeta ${input.carpeta}` : null, input.repartido ? `Repartido ${input.repartido}` : null]
    .filter(Boolean)
    .join(' · ')

  return {
    nombre: identificador || 'Asunto sin título identificable',
    calidadTitulo: 'incompleto',
    descripcion: descripcionDesdeMetadatos(input.carpeta, input.repartido),
    tipoAsunto: input.tipoAsunto,
  }
}
