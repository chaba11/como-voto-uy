import type {
  CalidadTituloAsunto,
  OrigenTituloAsunto,
} from '@como-voto-uy/shared'
import { obtenerOverrideTituloAsunto } from '../datos/titulos-asuntos-overrides.js'

export interface DatosCanonizadosAsunto {
  nombre: string
  tituloPublico: string
  origenTitulo: OrigenTituloAsunto
  calidadTitulo: CalidadTituloAsunto
  descripcion?: string
  tipoAsunto?: string
}

function limpiarEspacios(texto: string): string {
  return texto
    .replace(/([A-Za-zÁÉÍÓÚÑáéíóúñ])-\s+([A-Za-zÁÉÍÓÚÑáéíóúñ])/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}

function repararMojibake(texto: string): string {
  return texto
    .replace(/ÃƒÂ¡/g, 'á')
    .replace(/ÃƒÂ©/g, 'é')
    .replace(/ÃƒÂ­/g, 'í')
    .replace(/ÃƒÂ³/g, 'ó')
    .replace(/ÃƒÂº/g, 'ú')
    .replace(/ÃƒÂ±/g, 'ñ')
    .replace(/Ã‚Âº|Ã‚Â°/g, 'º')
    .replace(/Ã¢â‚¬Â¦/g, '…')
    .replace(/Ã¢â‚¬â€œ|Ã¢â‚¬â€/g, '—')
}

function quitarPrefijosSesion(texto: string): string {
  return repararMojibake(texto)
    .replace(/^\d+[)\.-]\s+/i, '')
    .replace(
      /^\(?\s*se (?:pasa a considerar|considera|somete a votación|somete a consideración)\s+/i,
      '',
    )
    .replace(/^corresponde votar\s+/i, '')
    .replace(/^ahora (?:consideramos|pasamos a considerar)\s+/i, '')
    .replace(/^se va a votar[:,]?\s*/i, '')
    .replace(/^\(?se vota\)?[:,]?\s*/i, '')
}

function limpiarRuidoParlamentario(texto: string): string {
  return limpiarEspacios(
    repararMojibake(texto)
      .replace(/\(Se vota\)/gi, ' ')
      .replace(/\bCarp(?:eta|\.)\s+N[.º°o ]*\s*\d+(?:\/\d+)?/gi, ' ')
      .replace(/\bRep(?:artido|\.)\s+N[.º°o ]*\s*\d+(?:\/\d+)?/gi, ' ')
      .replace(/[—-]{2,}.+$/g, ' ')
      .replace(/\b(?:afirmativa|negativa)\b\.?/gi, ' ')
      .replace(/\b(?:unanimidad|se aprueba|se levanta la sesión)\b\.?/gi, ' ')
      .replace(
        /\b(?:se pasa a considerar|se somete a votación|se somete a consideración|corresponde votar)\b/gi,
        ' ',
      )
      .replace(/\bcontin[uú]a\s+la\s+consideraci[oó]n\s+del\s+asunto\s+en\s+debate\b/gi, ' ')
      .replace(/\btiene\s+la\s+palabra\b.+$/gi, ' ')
      .replace(/\bantes\s+de\s+pasar\s+a\s+votar\b.+$/gi, ' ')
      .replace(/\b(?:discusión particular|discusión general|se entra a considerar)\b/gi, ' ')
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

function esFraseDeTramite(texto: string): boolean {
  const limpio = limpiarEspacios(repararMojibake(texto)).toLowerCase()
  return [
    /^\(ver\s+anexo\s+de\s+diario\s+de\s+sesiones\)$/,
    /^intermedio$/,
    /^\d+\.-\s*intermedio\b.*$/,
    /^intermedio\b.*$/,
    /^u\s*n\s*a\s*n\s*i\s*m\s*i\s*d\s*a\s*d\b.*$/,
    /^palabra\s+el\s+señor\s+senador\b.*$/,
    /^uso\s+de\s+la\s+palabra\b.*$/,
    /^no\s+se\s+hace\s+uso\s+de\s+la\s+palabra\b.*$/,
    /^proyecto\s+de\s+ley,\s*que\s+se\s+comunica.+$/,
    /^proyecto\s+de\s+resoluci[oó]n,\s*que\s+se\s+comunica.+$/,
    /^\d+[)\.-]\s+levantamiento\s+del\s+receso$/,
    /^\d+[)\.-]\s+levantamiento\s+de\s+la\s+sesi[oó]n\b.*$/,
    /^\d+[)\.-]\s+solicitudes?\s+de\s+licencia\b.*$/,
    /^\d+[)\.-]\s+exposiciones?\s+escritas?\b.*$/,
    /^\d+[)\.-]\s+reiteraci[oó]n\s+de\s+pedidos\s+de\s+informes$/,
    /^en\s+consideraci[oó]n\s+(?:el|la|los|las)\s+(?:art[ií]culo|aditivo|bloque|sustitutivo|hoja).+$/,
    /^se\s+va\s+a\s+votar\s+(?:el|la|los|las)\s+(?:art[ií]culo|aditivo|bloque|sustitutivo|hoja).+$/,
    /^solicito\s+que\s+se\s+suprima\s+su\s+lectura$/,
    /^aprobado\s+por\s+ser\s+igual\s+al\s+considerado\)?$/,
    /^sancionado\s+por\s+ser\s+igual\s+al\s+considerad[oa]?\)?$/,
    /^sancionado\s+por\s+ser\s+igual\s+al\s+consid.*$/,
    /^al\s+respecto$/,
    /^original.+$/,
    /^que\s+vamos\s+a\s+votar.*$/,
    /^que\s+estamos\s+analizando.*$/,
    /^que\s+el\s+señor\s+presidente\s+tenga\s+a\s+bien\s+tomar\s+la\s+votación.*$/,
    /^tomar\s+la\s+votación\s+de\s+manera\s+electrónica.*$/,
    /^gracias,\s+señor[ae]?\s+president[ea]\.?$/,
    /^si\s+no\s+se\s+hace\s+uso\s+de\s+la\s+palabra.*$/,
    /^se\s+abre\s+el\s+registro.*$/,
    /^se\s+cierra\s+el\s+registro.*$/,
    /^queda\s+aprobado.*$/,
    /^que\s+se\s+comunique.*$/,
    /^solicito\s+que\s+la\s+version\s+taquigrafica.*$/,
    /^dese\s+cuenta.*$/,
    /^se\s+lee.*$/,
    /^se\s+votara\s+oportunamente.*$/,
    /^se\s+votaran\s+oportunamente.*$/,
    /^esta\s+abierto\s+el\s+acto.*$/,
    /^murmullos.*$/,
    /^si\s+se\s+pasa\s+a\s+la.*$/,
    /^en\s+discusi[o?]n\s+particular.*$/,
    /^en\s+discusi[o?]n\s+general.*$/,
  ].some((patron) => patron.test(limpio))
}

function esTituloConversacional(texto: string): boolean {
  const limpio = limpiarEspacios(repararMojibake(texto)).toLowerCase()
  if (
    /pase\s+a\s+((?:la|las|el|los)\s+comisi[oó]n)/.test(limpio) ||
    /mocionamos\s+para\s+que\s+se\s+declare\s+urgente/.test(limpio)
  ) {
    return false
  }
  return [
    /^como\s+mencion[eé].+$/,
    /^simplemente\s+.+$/,
    /^ahora\s+vamos\s+a\s+votar.+$/,
    /^salvo\s+los\s+art[ií]culos?\s+.+$/,
    /^posteriormente,\s+.+$/,
    /^situaci[oó]n\s+de\s+.+$/,
    /^y\s+respecto\s+al?\s+.+$/,
    /^solicitamos\s+la\s+reconsideraci[oó]n.+$/,
    /^literal\s+[a-z]\)\s+.+$/,
    /^est[aá]\s+todo\s+el\s+ordinal\s+de\s+los\s+art[ií]culos.+$/,
    /^para\s+sacar\s+fotos\s+de\s+p[aá]jaros.+$/,
    /^proyecto\s+de\s+ley,\s*que\s+despu[eé]s\s+.+$/,
    /^proyecto\s+de\s+ley,\s*porque\s+.+$/,
    /^remitido\s+por\s+el\s+poder\s+ejecutivo,\s*se\s+trata\s+de\s+una\s+iniciativa.+$/,
    /^establec[ií]a\s+que\s+se\s+iban\s+a\s+tener\s+en\s+consideraci[oó]n.+$/,
    /^evaluaci[oó]n\s+del\s+frenillo\s+lingual.+fundamentos\s+de\s+voto.*$/,
    /^e\s+no\s+vuelvan\s+al\s+mundo\s+del\s+delito.*$/,
    /^ctura\s+normativa\s+.+$/,
    /^[a-záéíóúñ]\s+.+$/,
    /[¡!¿?]/,
    /\b(?:yo|nosotros|me|nos|quiero|quisiera|pedimos|solicitamos|mencion[eé]|vamos|voy)\b/,
  ].some((patron) => patron.test(limpio))
}

function esTituloFormalFuerte(texto: string): boolean {
  const limpio = limpiarEspacios(repararMojibake(texto)).toLowerCase()
  return (
    /^(aprueba|crea|modifica|faculta|incorpora|declara|establece|concede|autoriza|exonera|prorroga|regula|designa|evaluaci[oó]n|gesti[oó]n)\b/.test(
      limpio,
    ) ||
    /^pase\s+a\s+((?:la|las|el|los)\s+comisi[oó]n)/.test(limpio) ||
    /^llamado\s+a\s+sala\b/.test(limpio) ||
    /^solicitudes?\s+de\s+licencia\b/.test(limpio) ||
    /^r[eé]gimen\s+de\s+trabajo\b/.test(limpio) ||
    /^exposiciones?\s+escritas?\b/.test(limpio) ||
    /^exposici[oó]n\s+escrita\b/.test(limpio) ||
    /^acuerdo\s+transpac[ií]fico\b/.test(limpio) ||
    /^reiteraci[oó]n\s+de\s+pedidos\s+de\s+informes\b/.test(limpio) ||
    /^inasistencias?\s+anteriores\b/.test(limpio) ||
    /^postergaci[oó]n\s+del\s+numeral\b/.test(limpio) ||
    /^suspensi[oó]n\s+de\s+la\s+pr[oó]xima\b/.test(limpio) ||
    /^actividades?\s+del\s+movimiento\b/.test(limpio) ||
    /\bpresupuesto\s+nacional\b/.test(limpio) ||
    /\bacuerdo\s+de\s+transporte\b/.test(limpio)
  )
}

export function esTituloSubordinado(texto: string): boolean {
  const limpio = limpiarEspacios(repararMojibake(texto)).toLowerCase()
  return (
    esFraseDeTramite(limpio) ||
    esTituloGenerico(limpio) ||
    esTituloConversacional(limpio) ||
    limpio.startsWith('(') ||
    /^art[ií]culo\b/.test(limpio) ||
    /^en\s+consideraci[oó]n\b/.test(limpio) ||
    /^se\s+va\s+a\s+votar\b/.test(limpio) ||
    /^hoja\b/.test(limpio) ||
    /^aditivo\b/.test(limpio) ||
    /^bloque\b/.test(limpio) ||
    /^que\s+/.test(limpio)
  )
}

function esTituloGenerico(texto: string): boolean {
  const limpio = limpiarEspacios(repararMojibake(texto)).toLowerCase()
  return (
    /^asunto de sesión \d+ votación \d+$/.test(limpio) ||
    /^votación \d+$/.test(limpio) ||
    limpio === 'asunto sin título identificable' ||
    limpio === 'proyecto de ley'
  )
}

function normalizarCandidato(texto?: string): string | null {
  if (!texto?.trim()) return null
  const limpio = limpiarEspacios(repararMojibake(texto))
  return esTituloGenerico(limpio) || esFraseDeTramite(limpio) || esTituloConversacional(limpio)
    ? null
    : limpio
}

function tituloDesdeFormulaProyecto(texto: string): { nombre: string; tipoAsunto?: string } | null {
  const textoLimpio = quitarPrefijosSesion(texto)
  const mocionComision = /pase\s+a\s+((?:la|las|el|los)\s+comisi[oó]n[^\n.:;]+)/i.exec(
    textoLimpio,
  )?.[1]
  if (mocionComision && mocionComision.length >= 16) {
    return {
      nombre: recortarTitulo(
        capitalizarTitulo(`Pase a ${limpiarEspacios(mocionComision)}`),
      ),
      tipoAsunto: 'proyecto_ley',
    }
  }
  const autorizacionComision = /autorizaci[oó]n\s+a\s+la\s+comisi[oó]n\s+(.+?)\s+a\s+sesionar\s+en\s+forma\s+simult[aá]nea/i.exec(
    textoLimpio,
  )?.[1]
  if (autorizacionComision && autorizacionComision.length >= 12) {
    return {
      nombre: recortarTitulo(
        capitalizarTitulo(
          `Autorización a la Comisión ${limpiarEspacios(autorizacionComision)} a sesionar en forma simultánea con la sesión del Senado`,
        ),
      ),
      tipoAsunto: 'mocion_orden',
    }
  }
  const patrones: Array<{ patron: RegExp; tipo: string }> = [
    {
      patron:
        /proyecto\s+de\s+ley,?\s+(?:relacionado con|vinculado a)\s+(.+?)(?:[.;]|$)/i,
      tipo: 'proyecto_ley',
    },
    {
      patron:
        /proyecto\s+de\s+ley\s+(?:por\s+el|por\s+la|por\s+los|por\s+las)\s+(?:cual|que)\s+se\s+(.+?)(?:[.;]|$)/i,
      tipo: 'proyecto_ley',
    },
    {
      patron: /proyecto\s+de\s+ley\s+(?:sobre|relativo a|referente a)\s+(.+?)(?:[.;]|$)/i,
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
    {
      patron: /asunto\s+relativo\s+a:\s+["“](.+?)["”](?:\.\s|\s|$)/i,
      tipo: 'proyecto_ley',
    },
    {
      patron: /asunto\s+relativo\s+a:\s+(.+?)(?:\.\s|$|\(ANTECEDENTES:?)/i,
      tipo: 'proyecto_ley',
    },
    {
      patron: /tiene\s+por\s+objeto\s+(.+?)(?:[.;]|$)/i,
      tipo: 'proyecto_ley',
    },
    {
      patron: /\d+\.-\s+(.+?)(?:\s+De acuerdo con lo resuelto|$)/i,
      tipo: 'proyecto_ley',
    },
  ]

  for (const { patron, tipo } of patrones) {
    const match = patron.exec(textoLimpio)
    if (!match?.[1]) continue

    let nombre = limpiarRuidoParlamentario(match[1])
    if (nombre.includes(':')) {
      const partes = nombre.split(':').map((parte) => limpiarEspacios(parte)).filter(Boolean)
      nombre = partes.at(-1) ?? nombre
    }
    nombre = nombre.replace(/^["“]\s*/, '').replace(/\s*["”]$/, '')
    nombre = nombre.replace(/^(sobre|relativo a|referente a)\s+/i, '')
    nombre = nombre.replace(/^(la|el|los|las)\s+/i, '')
    nombre = capitalizarTitulo(nombre)

    if (
      nombre.length < 8 ||
      esFraseDeTramite(nombre) ||
      /tomar\s+la\s+votación\s+de\s+manera\s+electrónica/i.test(nombre)
    ) {
      continue
    }

    return {
      nombre: recortarTitulo(nombre),
      tipoAsunto: tipo,
    }
  }

  return null
}

function normalizarEncabezadoAgenda(texto: string): string | null {
  const encabezado = limpiarEspacios(
    repararMojibake(texto)
      .replace(/\bCÁMARA\s+DE\s+SENADORES\b/gi, ' ')
      .replace(/^\d+[)\.-]\s+/i, '')
      .split(/SEÑOR(?:A)?\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.()-]*\.-/)[0] ?? '',
  )

  if (!encabezado || encabezado.length < 12) return null

  const palabras = encabezado.split(/\s+/).filter(Boolean)
  const proporcionMayusculas =
    palabras.length === 0
      ? 0
      : palabras.filter((palabra) => /[A-ZÁÉÍÓÚÑ]{3,}/.test(palabra)).length / palabras.length

  if (proporcionMayusculas < 0.55) return null
  if (/^(sesión|acta|montevideo\b)/i.test(encabezado)) return null

  return encabezado
}

function tituloDesdeContexto(texto: string): string | null {
  const limpio = limpiarRuidoParlamentario(quitarPrefijosSesion(texto))
  const encabezadoAgenda = normalizarEncabezadoAgenda(limpio)
  if (encabezadoAgenda && !esFraseDeTramite(encabezadoAgenda)) {
    return recortarTitulo(capitalizarTitulo(encabezadoAgenda))
  }
  const mocionComision = /pase\s+a\s+((?:la|las|el|los)\s+comisi[oó]n[^\n.:;]+)/i.exec(
    limpio,
  )?.[1]
  if (mocionComision && mocionComision.length >= 16) {
    return recortarTitulo(capitalizarTitulo(`Pase a ${limpiarEspacios(mocionComision)}`))
  }
  const oraciones = limpio
    .split(/[\n.;]\s+/)
    .map((oracion) => limpiarEspacios(quitarPrefijosSesion(oracion)))
    .filter(
      (oracion) =>
        oracion.length >= 12 &&
        !esFraseDeTramite(oracion) &&
        !esTituloConversacional(oracion),
    )

  for (const oracion of oraciones) {
    const desdeProyecto = tituloDesdeFormulaProyecto(oracion)
    if (desdeProyecto) {
      return recortarTitulo(desdeProyecto.nombre)
    }
  }

  for (const oracion of oraciones) {
    if (/^(se|corresponde|votación|votacion|carpeta|repartido)\b/i.test(oracion)) continue
    const candidata = oracion
      .replace(/^(primer|primera|segundo|segunda|tercer|tercera)\s+/i, '')
      .replace(/^proyecto\s+de\s+(?:ley|resolución|resolucion|decreto|minuta\s+de\s+comunicación|minuta\s+de\s+comunicacion)\s+/i, '')
      .replace(/^(sobre|relativo a|referente a)\s+/i, '')
      .replace(/^(la|el|los|las)\s+/i, '')

    if (!candidata || esFraseDeTramite(candidata) || esTituloConversacional(candidata)) continue
    return recortarTitulo(capitalizarTitulo(candidata))
  }

  return null
}

export function extraerDescripcionContextual(textoContexto: string): string | undefined {
  if (!textoContexto?.trim()) return undefined

  let texto = limpiarEspacios(repararMojibake(textoContexto))

  // Estrategia 1: texto entrecomillado con «...»
  const entrecomillado = /«([\s\S]+?)»/.exec(texto)
  if (entrecomillado?.[1] && entrecomillado[1].length >= 30) {
    texto = limpiarEspacios(entrecomillado[1])
  } else {
    // Estrategia 2: lectura del secretario
    const lecturaSecretario = /SEÑOR(?:A)?\s+SECRETARI[OA][^.]*\.-\s*([\s\S]+)/i.exec(texto)
    if (lecturaSecretario?.[1]) {
      texto = limpiarEspacios(lecturaSecretario[1])
    } else {
      // Estrategia 3: texto después del encabezado de agenda en mayúsculas
      const encabezadoAgenda = /\d+\)\s+[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s,.\-/()]+?\.\s*[-–—]?\s*([\s\S]+)/
        .exec(texto)
      if (encabezadoAgenda?.[1]) {
        texto = limpiarEspacios(encabezadoAgenda[1])
      }
    }
  }

  // Limpiar prefijos procedimentales
  texto = texto
    .replace(/^Léase\s+una\s+moción\s+de\s+orden[.:]\s*/i, '')
    .replace(/^\(Se lee[.:)]\s*/i, '')
    .replace(/^Mocionamos\s+para\s+que\s+se\s+declare\s+urgente\s+y\s+se\s+considere\s+de\s+inmediato[.:]\s*/i, '')
    .replace(/^De acuerdo con lo resuelto[^,]*,\s*/i, '')
    .replace(/^En discusión (?:general|particular)[.:]\s*/i, '')

  // Quitar firmas
  texto = texto.replace(/\(Firma[ns]?\s+[^)]+\)/gi, '')

  // Quitar ruido parlamentario
  texto = texto
    .replace(/\(Se lee\)/gi, '')
    .replace(/\(Se vota\)/gi, '')
    .replace(/Léase\s+una\s+moción\s+de\s+orden\.?/gi, '')

  // Quitar referencias a carpeta/repartido (ya se muestran aparte)
  texto = texto
    .replace(/\bCarp(?:eta|\.)\s+[Nn]\.?\s*[°ºo]?\s*\d+(?:\/\d+)?/gi, '')
    .replace(/\bRep(?:artido|\.)\s+[Nn]\.?\s*[°ºo]?\s*\d+(?:\/\d+)?/gi, '')

  // Quitar ANTECEDENTES:
  texto = texto.replace(/\(?\s*ANTECEDENTES?:?[^)]*\)?\s*/gi, '')

  texto = limpiarEspacios(texto)

  // Quitar puntos/guiones sueltos al inicio
  texto = texto.replace(/^[.\-–—:;\s]+/, '').trim()

  if (texto.length < 30) return undefined

  // Truncar a ~1000 chars
  if (texto.length > 1000) {
    texto = `${texto.slice(0, 1000).trimEnd()}…`
  }

  return texto
}

function descripcionDesdeMetadatos(carpeta?: string, repartido?: string): string | undefined {
  const partes = []
  if (carpeta) partes.push(`Carpeta n.º ${carpeta}`)
  if (repartido) partes.push(`Repartido n.º ${repartido}`)
  return partes.length > 0 ? partes.join(' · ') : undefined
}

function construirIdentificadorPublico(input: {
  carpeta?: string
  repartido?: string
  numeroLey?: string
}): string | null {
  const partes = []
  if (input.numeroLey) partes.push(`Ley ${input.numeroLey}`)
  if (input.carpeta) partes.push(`Carpeta ${input.carpeta}`)
  if (input.repartido) partes.push(`Repartido ${input.repartido}`)
  return partes.length > 0 ? partes.join(' · ') : null
}

export function canonizarAsunto(input: {
  nombreCrudo?: string
  textoContexto?: string
  carpeta?: string
  repartido?: string
  numeroLey?: string
  codigoOficial?: string
  cuerpo?: 'senado' | 'representantes'
  sesionNumero?: number
  ordenSesion?: number
  tipoAsunto?: string
}): DatosCanonizadosAsunto {
  const candidatos = [normalizarCandidato(input.nombreCrudo), normalizarCandidato(input.textoContexto)].filter(
    (valor): valor is string => !!valor?.trim(),
  )

  const override = obtenerOverrideTituloAsunto({
    codigoOficial: input.codigoOficial,
    carpeta: input.carpeta,
    repartido: input.repartido,
    cuerpo: input.cuerpo,
    sesionNumero: input.sesionNumero,
    ordenSesion: input.ordenSesion,
  })

  for (const candidato of candidatos) {
    const desdeProyecto = tituloDesdeFormulaProyecto(candidato)
    if (desdeProyecto) {
      const nombre = override?.nombre ?? desdeProyecto.nombre
      const tituloPublico = override?.tituloPublico ?? desdeProyecto.nombre
      return {
        nombre,
        tituloPublico,
        origenTitulo: override ? 'override_manual' : 'estructurado',
        calidadTitulo: 'canonico',
        descripcion: extraerDescripcionContextual(input.textoContexto ?? '')
          ?? descripcionDesdeMetadatos(input.carpeta, input.repartido),
        tipoAsunto: input.tipoAsunto ?? desdeProyecto.tipoAsunto,
      }
    }
  }

  const contexto = candidatos
    .map((candidato) => tituloDesdeContexto(candidato))
    .find((valor): valor is string => !!valor)

  if (contexto) {
    const nombre = override?.nombre ?? contexto
    const tituloPublico = override?.tituloPublico ?? contexto
    return {
      nombre,
      tituloPublico,
      origenTitulo: override ? 'override_manual' : 'contexto',
      calidadTitulo:
        input.carpeta || input.repartido
          ? 'razonable'
          : esTituloFormalFuerte(tituloPublico)
            ? 'razonable'
            : 'incompleto',
      descripcion: extraerDescripcionContextual(input.textoContexto ?? '')
        ?? descripcionDesdeMetadatos(input.carpeta, input.repartido),
      tipoAsunto: input.tipoAsunto,
    }
  }

  const identificador =
    construirIdentificadorPublico({
      carpeta: input.carpeta,
      repartido: input.repartido,
      numeroLey: input.numeroLey,
    }) ?? 'Asunto sin título identificable'

  return {
    nombre: override?.nombre ?? identificador,
    tituloPublico: override?.tituloPublico ?? identificador,
    origenTitulo: override ? 'override_manual' : 'identificador',
    calidadTitulo: 'incompleto',
    descripcion: extraerDescripcionContextual(input.textoContexto ?? '')
      ?? descripcionDesdeMetadatos(input.carpeta, input.repartido),
    tipoAsunto: input.tipoAsunto,
  }
}
