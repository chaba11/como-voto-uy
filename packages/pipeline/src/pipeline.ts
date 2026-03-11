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
import type { DatosSesion, DatosVotacion } from './loader/cargador-sesion.js'
import { canonizarAsunto } from './parser/canonizador-asuntos.js'
import { buscarLegislador } from './parser/normalizador-nombres.js'
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
}

function limpiarTextoContexto(texto: string): string {
  let limpio = texto.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

  const seVota = limpio.search(/(?:Se va a votar|\(Se vota\))/i)
  if (seVota > 0) {
    limpio = limpio.slice(0, seVota).trim()
  }

  return limpio.replace(/^[\d\s)\-–—]+/, '').trim()
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
  const existenteId = buscarLegislador(nombre, universo)
  if (existenteId !== null) return existenteId

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
    tipoAsunto: votacion.proyecto?.tipoAsunto,
  })

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

      const votacionesCargables = parseo.votaciones.map((votacion, indice) =>
        votacionADatosVotacion(
          db,
          opciones.camara,
          legislaturaId,
          votacion,
          listaLegisladores,
          indice + 1,
          entrada.urlDocumentoPagina,
        ),
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
