import { and, eq } from 'drizzle-orm'
import {
  legisladores,
  legislaturas,
  partidos,
  sesiones,
  type Camara,
  type CuerpoLegislativo,
  type NivelConfianzaVoto,
} from '@como-voto-uy/shared'
import { crearConexion } from './db/conexion.js'
import type { DB } from './db/conexion.js'
import { pushearSchema } from './db/migraciones.js'
import { cargarSesion } from './loader/cargador-sesion.js'
import {
  cargarAfiliacionesHistoricas,
  resolverLegisladorPorContexto,
} from './loader/cargador-afiliaciones.js'
import type { DatosSesion, DatosVotacion } from './loader/cargador-sesion.js'
import { canonizarAsunto, esTituloSubordinado } from './parser/canonizador-asuntos.js'
import { buscarLegisladorConAlias } from './parser/normalizador-nombres.js'
import { parsearTaquigrafica } from './parser/index.js'
import type { VotacionExtraida } from './parser/tipos-parser.js'
import { descargarDocumento } from './scraper/descargador.js'
import { obtenerListadoSesiones } from './scraper/listado.js'
import { seedLegisladores } from './seed/legisladores.js'
import { seedLegislaturas } from './seed/legislaturas.js'
import { seedPartidos } from './seed/partidos.js'

type LegisladorCache = {
  id: number
  nombre: string
  camara: Camara
  legislaturaId: number
  partidoId: number
  alias: string[]
}

function limpiarTextoContexto(texto: string): string {
  let limpio = texto.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

  const seVota = limpio.search(/(?:Se va a votar|\(Se vota\))/i)
  if (seVota > 0) {
    limpio = limpio.slice(0, seVota).trim()
  }

  return limpio.replace(/^[\d\s)\-â€“â€”]+/, '').trim()
}

function cuerpoDesdeCamara(camara: Camara): CuerpoLegislativo {
  return camara
}

function obtenerLegislaturaId(db: DB, numero: number): number {
  const legislatura = db
    .select({ id: legislaturas.id })
    .from(legislaturas)
    .where(eq(legislaturas.numero, numero))
    .get()

  if (!legislatura) {
    throw new Error(`Legislatura ${numero} no encontrada`)
  }

  return legislatura.id
}

function sesionExiste(
  db: DB,
  legislaturaId: number,
  cuerpo: CuerpoLegislativo,
  numero: number,
): boolean {
  const existente = db
    .select({ id: sesiones.id })
    .from(sesiones)
    .where(
      and(
        eq(sesiones.legislaturaId, legislaturaId),
        eq(sesiones.cuerpo, cuerpo),
        eq(sesiones.numero, numero),
      ),
    )
    .get()

  return !!existente
}

function obtenerLegisladoresCamara(
  db: DB,
  camara: Camara,
  legislaturaId: number,
): LegisladorCache[] {
  return db
    .select({
      id: legisladores.id,
      nombre: legisladores.nombre,
      camara: legisladores.camara,
      legislaturaId: legisladores.legislaturaId,
      partidoId: legisladores.partidoId,
    })
    .from(legisladores)
    .where(
      and(
        eq(legisladores.camara, camara),
        eq(legisladores.legislaturaId, legislaturaId),
      ),
    )
    .all()
    .map((legislador) => ({ ...legislador, alias: [legislador.nombre] }))
}

function obtenerPartidoSinAsignar(db: DB): number {
  const partido = db
    .select({ id: partidos.id })
    .from(partidos)
    .where(eq(partidos.sigla, 'SA'))
    .get()

  if (partido) return partido.id

  return db
    .insert(partidos)
    .values({ nombre: 'Sin asignar', sigla: 'SA', color: '#999999' })
    .returning({ id: partidos.id })
    .get().id
}

function obtenerOCrearLegislador(
  db: DB,
  nombre: string,
  camara: Camara,
  legislaturaId: number,
  cache: LegisladorCache[],
): number {
  const universo = cache.filter(
    (legislador) =>
      legislador.camara === camara && legislador.legislaturaId === legislaturaId,
  )
  const existenteId = buscarLegisladorConAlias(nombre, universo)
  if (existenteId !== null) return existenteId

  const existentePorAlias = resolverLegisladorPorContexto(
    db,
    nombre,
    legislaturaId,
    camara,
  )
  if (existentePorAlias !== null) {
    const existente = db
      .select({
        id: legisladores.id,
        nombre: legisladores.nombre,
        camara: legisladores.camara,
        legislaturaId: legisladores.legislaturaId,
        partidoId: legisladores.partidoId,
      })
      .from(legisladores)
      .where(eq(legisladores.id, existentePorAlias))
      .get()

    if (existente && !cache.some((legislador) => legislador.id === existente.id)) {
      cache.push({ ...existente, alias: [existente.nombre] })
    }
    return existentePorAlias
  }

  const insertado = db
    .insert(legisladores)
    .values({
      nombre: nombre.trim(),
      legislaturaId,
      partidoId: obtenerPartidoSinAsignar(db),
      camara,
      origenPartido: 'sin_asignar',
    })
    .returning({
      id: legisladores.id,
      nombre: legisladores.nombre,
      camara: legisladores.camara,
      legislaturaId: legisladores.legislaturaId,
      partidoId: legisladores.partidoId,
      alias: [legisladores.nombre],
    })
    .get()

  cache.push(insertado)
  console.warn(
    `Legislador sin resolución automática: ${nombre.trim()} (${camara}, legislatura ${legislaturaId})`,
  )
  return insertado.id
}

function nivelConfianzaAsunto(votacion: VotacionExtraida): NivelConfianzaVoto {
  if (votacion.proyecto?.carpeta || votacion.proyecto?.repartido) return 'alto'
  if (votacion.proyecto?.nombre) return 'alto'
  return 'medio'
}

function limpiarDetalleTecnico(texto: string): string {
  return texto
    .replace(/\s+/g, ' ')
    .replace(/\s*([,.;:])\s*/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extraerDetalleTecnicoVotacion(textoContexto: string): string | undefined {
  const texto = textoContexto.replace(/\s+/g, ' ').trim()

  const patrones: RegExp[] = [
    /en\s+consideraci[oó]n\s+el\s+art[ií]culo\s+\d+[^\n.]{0,120}/i,
    /en\s+consideraci[oó]n\s+nuevamente\s+el\s+art[ií]culo\s+\d+[^\n.]{0,120}/i,
    /en\s+consideraci[oó]n\s+el\s+aditivo\s+\d+[^\n.]{0,120}/i,
    /en\s+consideraci[oó]n\s+la\s+hoja\s+\d+[^\n.]{0,120}/i,
    /en\s+consideraci[oó]n\s+el\s+sustitutivo\s+de\s+la\s+hoja\s+\d+[^\n.]{0,120}/i,
    /en\s+consideraci[oó]n\s+el\s+art[ií]culo\s+sustitutivo\s+del\s+art[ií]culo\s+\d+[^\n.]{0,120}/i,
    /en\s+consideraci[oó]n\s+el\s+bloque\s+de\s+los\s+art[ií]culos\s+[\d,\sy\-]+/i,
    /se\s+va\s+a\s+votar\s+el\s+art[ií]culo\s+\d+[^\n.]{0,120}/i,
    /se\s+va\s+a\s+votar\s+el\s+sustitutivo\s+de\s+la\s+hoja\s+\d+[^\n.]{0,120}/i,
  ]

  for (const patron of patrones) {
    const match = patron.exec(texto)
    if (match?.[0]) return limpiarDetalleTecnico(match[0])
  }

  return undefined
}

function esTituloRuidoParlamentario(titulo: string): boolean {
  const limpio = titulo
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  return [
    /^asunto sin titulo identificable$/,
    /^u\s*n\s*a\s*n\s*i\s*m\s*i\s*d\s*a\s*d\b/,
    /^palabra el senor senador\b/,
    /^uso de la palabra\b/,
    /^no se hace uso de la palabra\b/,
    /^proyecto de ley,\s*que se comunica/,
    /^proyecto de resolucion,\s*que se comunica/,
    /^\d+[)\.-]\s+levantamiento del receso$/,
    /^\d+[)\.-]\s+reiteracion de pedidos de informes$/,
    /^e?ñora presidenta\.-?$/,
    /^senora presidenta\.-?$/,
  ].some((patron) => patron.test(limpio))
}

function esAsuntoPrincipal(asuntoCanonico: ReturnType<typeof canonizarAsunto>): boolean {
  return (
    !esTituloSubordinado(asuntoCanonico.tituloPublico) &&
    !esTituloRuidoParlamentario(asuntoCanonico.tituloPublico)
  )
}

function construirDatosVotacion(
  db: DB,
  camara: Camara,
  legislaturaId: number,
  votacion: VotacionExtraida,
  listaLegisladores: LegisladorCache[],
  ordenSesion: number,
  fuenteUrl: string,
  asuntoCanonico: ReturnType<typeof canonizarAsunto>,
  textoContexto: string,
): DatosVotacion {
  const votosIndividuales = (votacion.votos ?? []).map((voto) => ({
    legisladorId: obtenerOCrearLegislador(
      db,
      voto.nombreLegislador,
      camara,
      legislaturaId,
      listaLegisladores,
    ),
    voto: voto.voto,
    nivelConfianza: 'confirmado' as const,
    esOficial: true,
  }))

  const resultadoAgregado = votacion.resultado
    ? {
        afirmativos: votacion.resultado.afirmativos,
        negativos:
          votacion.resultado.total != null && votacion.resultado.afirmativos != null
            ? votacion.resultado.total - votacion.resultado.afirmativos
            : undefined,
        totalPresentes: votacion.resultado.total,
        unanimidad: votacion.resultado.unanimidad,
        resultado: votacion.resultado.resultado,
      }
    : undefined

  const estadoCobertura = votosIndividuales.length
    ? 'individual_confirmado'
    : resultadoAgregado
      ? 'agregado'
      : 'sin_desglose_publico'

  return {
    asunto: {
      nombre: asuntoCanonico.nombre,
      tituloPublico: asuntoCanonico.tituloPublico,
      origenTitulo: asuntoCanonico.origenTitulo,
      calidadTitulo: asuntoCanonico.calidadTitulo,
      descripcion: asuntoCanonico.descripcion,
      carpeta: votacion.proyecto?.carpeta,
      repartido: votacion.proyecto?.repartido,
      tipoAsunto: asuntoCanonico.tipoAsunto,
      codigoOficial:
        votacion.proyecto?.carpeta && votacion.proyecto?.repartido
          ? `${votacion.proyecto.carpeta}-${votacion.proyecto.repartido}`
          : votacion.proyecto?.carpeta,
    },
    ordenSesion,
    modalidad: votacion.tipo === 'nominal' ? 'nominal' : 'ordinaria',
    detalleTitulo: extraerDetalleTecnicoVotacion(textoContexto),
    estadoCobertura,
    nivelConfianza: votosIndividuales.length ? nivelConfianzaAsunto(votacion) : 'alto',
    esOficial: true,
    resultado: votacion.resultado?.resultado,
    fuentePrincipal: {
      tipo: 'taquigrafica_html',
      url: fuenteUrl,
    },
    votosIndividuales,
    resultadoAgregado,
    evidencias: [
      {
        tipo: 'texto',
        texto: textoContexto,
        detalle: votosIndividuales.length
          ? 'Contexto de votación nominal en diario oficial'
          : 'Contexto de resultado agregado en diario oficial',
      },
    ],
  }
}

export function votacionADatosVotacion(
  db: DB,
  camara: Camara,
  legislaturaId: number,
  votacion: VotacionExtraida,
  listaLegisladores: LegisladorCache[],
  ordenSesion: number,
  fuenteUrl: string,
): DatosVotacion {
  const textoContexto = limpiarTextoContexto(votacion.textoContexto)
  const asuntoCanonico = canonizarAsunto({
    nombreCrudo: votacion.proyecto?.nombre,
    textoContexto,
    carpeta: votacion.proyecto?.carpeta,
    repartido: votacion.proyecto?.repartido,
    cuerpo: camara,
    ordenSesion,
    tipoAsunto: votacion.proyecto?.tipoAsunto,
  })

  return construirDatosVotacion(
    db,
    camara,
    legislaturaId,
    votacion,
    listaLegisladores,
    ordenSesion,
    fuenteUrl,
    asuntoCanonico,
    textoContexto,
  )
}

export function votacionesADatosSesion(
  db: DB,
  camara: Camara,
  legislaturaId: number,
  votaciones: VotacionExtraida[],
  listaLegisladores: LegisladorCache[],
  fuenteUrl: string,
  sesionNumero?: number,
): DatosVotacion[] {
  let ultimoAsuntoPrincipal: ReturnType<typeof canonizarAsunto> | null = null

  return votaciones.map((votacion, indice) => {
    const textoContexto = limpiarTextoContexto(votacion.textoContexto)
    const asuntoBase = canonizarAsunto({
      nombreCrudo: votacion.proyecto?.nombre,
      textoContexto,
      carpeta: votacion.proyecto?.carpeta,
      repartido: votacion.proyecto?.repartido,
      cuerpo: camara,
      sesionNumero,
      ordenSesion: indice + 1,
      tipoAsunto: votacion.proyecto?.tipoAsunto,
    })

    const asuntoCanonico =
      ultimoAsuntoPrincipal &&
      (esTituloSubordinado(asuntoBase.tituloPublico) ||
        esTituloRuidoParlamentario(asuntoBase.tituloPublico))
        ? {
            ...ultimoAsuntoPrincipal,
            descripcion: asuntoBase.descripcion ?? ultimoAsuntoPrincipal.descripcion,
          }
        : asuntoBase

    if (esAsuntoPrincipal(asuntoCanonico)) {
      ultimoAsuntoPrincipal = asuntoCanonico
    }

    return construirDatosVotacion(
      db,
      camara,
      legislaturaId,
      votacion,
      listaLegisladores,
      indice + 1,
      fuenteUrl,
      asuntoCanonico,
      textoContexto,
    )
  })
}

export interface OpcionesPipeline {
  camara: Camara
  legislatura: number
  rutaDb: string
  limite?: number
  resetearDb?: boolean
}

export interface ResultadoPipeline {
  sesionesListadas: number
  sesionesNuevas: number
  sesionesOmitidas: number
  sesionesConError: number
  votacionesExtraidas: number
  errores: string[]
}

export async function ejecutarPipeline(
  opciones: OpcionesPipeline,
): Promise<ResultadoPipeline> {
  const resultado: ResultadoPipeline = {
    sesionesListadas: 0,
    sesionesNuevas: 0,
    sesionesOmitidas: 0,
    sesionesConError: 0,
    votacionesExtraidas: 0,
    errores: [],
  }

  const { db, sqlite } = crearConexion(opciones.rutaDb)
  if (opciones.resetearDb ?? true) {
    pushearSchema(sqlite)
  }

  seedPartidos(db)
  seedLegislaturas(db)
  seedLegisladores(db)
  await cargarAfiliacionesHistoricas(db, {
    camara: opciones.camara,
    legislaturas: [opciones.legislatura],
  })

  const legislaturaId = obtenerLegislaturaId(db, opciones.legislatura)
  const cuerpo = cuerpoDesdeCamara(opciones.camara)
  const listaLegisladores = obtenerLegisladoresCamara(db, opciones.camara, legislaturaId)

  const entradas = await obtenerListadoSesiones(opciones.camara, opciones.legislatura)
  resultado.sesionesListadas = entradas.length

  const entradasAProcesar = opciones.limite ? entradas.slice(0, opciones.limite) : entradas

  for (const entrada of entradasAProcesar) {
    if (sesionExiste(db, legislaturaId, cuerpo, entrada.sesionNumero)) {
      resultado.sesionesOmitidas++
      continue
    }

    try {
      const documento = await descargarDocumento(entrada)
      const parseo = parsearTaquigrafica(documento.contenido)

      const votacionesCargables = votacionesADatosSesion(
        db,
        opciones.camara,
        legislaturaId,
        parseo.votaciones,
        listaLegisladores,
        entrada.urlDocumentoPagina,
        entrada.sesionNumero,
      )

      const datosSesion: DatosSesion = {
        legislaturaId,
        cuerpo,
        fecha: entrada.fecha,
        numero: entrada.sesionNumero,
        urlTaquigrafica: entrada.urlDocumentoPagina,
        fuente: {
          tipo: entrada.tipoDocumento === 'pdf' ? 'diario_pdf' : 'taquigrafica_html',
          url: entrada.urlDocumentoPagina,
        },
        votaciones: votacionesCargables,
      }

      cargarSesion(db, datosSesion)
      resultado.sesionesNuevas++
      resultado.votacionesExtraidas += parseo.votaciones.length
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error)
      resultado.sesionesConError++
      resultado.errores.push(`Sesión ${entrada.sesionNumero}: ${mensaje}`)
    }
  }

  sqlite.close()
  return resultado
}

export { obtenerLegisladoresCamara, obtenerLegislaturaId }
