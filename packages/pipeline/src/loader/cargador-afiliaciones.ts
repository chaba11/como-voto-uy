import { and, asc, eq, ne } from 'drizzle-orm'
import {
  aliasLegisladores,
  fuentes,
  legisladores,
  legislaturas,
  partidos,
  resolucionesAfiliacion,
  type Camara,
  type MetodoResolucionAfiliacion,
  type NivelConfianzaVoto,
  type OrigenPartidoLegislador,
  type TipoFuente,
} from '@como-voto-uy/shared'
import type { DB } from '../db/conexion.js'
import { buscarLegisladorConAlias } from '../parser/normalizador-nombres.js'
import type { RegistroAfiliacionFuente } from '../scraper/afiliaciones-legisladores.js'
import { obtenerRegistrosAfiliacionPorFuente } from '../scraper/afiliaciones-legisladores.js'
import { resolverSiglaPartido } from '../seed/partidos.js'

interface LegisladorConAlias {
  id: number
  nombre: string
  camara: Camara
  legislaturaId: number
  partidoId: number
  origenPartido: OrigenPartidoLegislador
  alias: string[]
}

export interface ReporteCoberturaAfiliacion {
  camara: Camara
  legislatura: number
  total: number
  resueltos: number
  sinAsignar: number
  porcentajeCobertura: number
  pendientes: string[]
}

export interface ResultadoCargaAfiliaciones {
  registrosProcesados: number
  legisladoresCreados: number
  legisladoresActualizados: number
  aliasRegistrados: number
  resolucionesRegistradas: number
  sinAsignar: number
  reconciliadosInterlegislatura: number
  reportes: ReporteCoberturaAfiliacion[]
}

function prioridadMetodo(metodo: MetodoResolucionAfiliacion): number {
  switch (metodo) {
    case 'dataset':
      return 500
    case 'padron_pdf':
      return 400
    case 'biografia':
      return 300
    case 'asistencia':
      return 200
    case 'inferido_por_alias':
      return 100
    case 'sin_asignar':
      return 0
  }
}

function prioridadConfianza(nivel: NivelConfianzaVoto): number {
  switch (nivel) {
    case 'confirmado':
      return 4
    case 'alto':
      return 3
    case 'medio':
      return 2
    case 'bajo':
      return 1
  }
}

function origenDesdeMetodo(
  metodo: MetodoResolucionAfiliacion,
): OrigenPartidoLegislador {
  switch (metodo) {
    case 'dataset':
      return 'dataset'
    case 'padron_pdf':
      return 'padron'
    case 'biografia':
      return 'biografia'
    case 'asistencia':
      return 'asistencia'
    case 'inferido_por_alias':
      return 'inferido'
    case 'sin_asignar':
      return 'sin_asignar'
  }
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

function obtenerPartidoIdPorSigla(db: DB, sigla: string): number | null {
  return (
    db
      .select({ id: partidos.id })
      .from(partidos)
      .where(eq(partidos.sigla, sigla))
      .get()?.id ?? null
  )
}

function obtenerPartidoSinAsignar(db: DB): number {
  const existente = obtenerPartidoIdPorSigla(db, 'SA')
  if (existente) return existente

  return db
    .insert(partidos)
    .values({ nombre: 'Sin asignar', sigla: 'SA', color: '#999999' })
    .returning({ id: partidos.id })
    .get().id
}

function obtenerFuenteId(db: DB, tipo: TipoFuente, url: string): number {
  const existente = db
    .select({ id: fuentes.id })
    .from(fuentes)
    .where(and(eq(fuentes.tipo, tipo), eq(fuentes.url, url)))
    .get()

  if (existente) return existente.id

  return db
    .insert(fuentes)
    .values({
      tipo,
      url,
      fechaCaptura: new Date().toISOString(),
    })
    .returning({ id: fuentes.id })
    .get().id
}

function obtenerLegisladoresContexto(
  db: DB,
  legislaturaId: number,
  camara: Camara,
): LegisladorConAlias[] {
  const filas = db
    .select({
      id: legisladores.id,
      nombre: legisladores.nombre,
      camara: legisladores.camara,
      legislaturaId: legisladores.legislaturaId,
      partidoId: legisladores.partidoId,
      origenPartido: legisladores.origenPartido,
      alias: aliasLegisladores.alias,
    })
    .from(legisladores)
    .leftJoin(aliasLegisladores, eq(aliasLegisladores.legisladorId, legisladores.id))
    .where(
      and(
        eq(legisladores.legislaturaId, legislaturaId),
        eq(legisladores.camara, camara),
      ),
    )
    .orderBy(asc(legisladores.id))
    .all()

  const mapa = new Map<number, LegisladorConAlias>()
  for (const fila of filas) {
    const existente = mapa.get(fila.id)
    if (existente) {
      if (fila.alias) existente.alias.push(fila.alias)
      continue
    }

    mapa.set(fila.id, {
      id: fila.id,
      nombre: fila.nombre,
      camara: fila.camara,
      legislaturaId: fila.legislaturaId,
      partidoId: fila.partidoId,
      origenPartido: fila.origenPartido,
      alias: fila.alias ? [fila.alias] : [],
    })
  }

  return [...mapa.values()]
}

function obtenerMejorResolucionActual(db: DB, legisladorId: number) {
  return db
    .select({
      partidoId: resolucionesAfiliacion.partidoId,
      metodo: resolucionesAfiliacion.metodo,
      nivelConfianza: resolucionesAfiliacion.nivelConfianza,
    })
    .from(resolucionesAfiliacion)
    .where(eq(resolucionesAfiliacion.legisladorId, legisladorId))
    .all()
    .sort((a, b) => {
      const prioridadB = prioridadMetodo(b.metodo) * 10 + prioridadConfianza(b.nivelConfianza)
      const prioridadA = prioridadMetodo(a.metodo) * 10 + prioridadConfianza(a.nivelConfianza)
      return prioridadB - prioridadA
    })[0] ?? null
}

function debeActualizarResolucion(
  actual: { metodo: MetodoResolucionAfiliacion; nivelConfianza: NivelConfianzaVoto } | null,
  nueva: { metodo: MetodoResolucionAfiliacion; nivelConfianza: NivelConfianzaVoto },
): boolean {
  if (!actual) return true

  const prioridadActual =
    prioridadMetodo(actual.metodo) * 10 + prioridadConfianza(actual.nivelConfianza)
  const prioridadNueva =
    prioridadMetodo(nueva.metodo) * 10 + prioridadConfianza(nueva.nivelConfianza)

  return prioridadNueva >= prioridadActual
}

function registrarAlias(
  db: DB,
  legisladorId: number,
  alias: string,
  nivelConfianza: NivelConfianzaVoto,
  fuenteId: number | null,
): boolean {
  const valor = alias.trim()
  if (!valor) return false

  const existente = db
    .select({ id: aliasLegisladores.id })
    .from(aliasLegisladores)
    .where(
      and(
        eq(aliasLegisladores.legisladorId, legisladorId),
        eq(aliasLegisladores.alias, valor),
      ),
    )
    .get()

  if (existente) return false

  db.insert(aliasLegisladores)
    .values({
      legisladorId,
      alias: valor,
      nivelConfianza,
      fuenteId,
    })
    .run()
  return true
}

function registrarResolucion(
  db: DB,
  legisladorId: number,
  partidoId: number,
  metodo: MetodoResolucionAfiliacion,
  nivelConfianza: NivelConfianzaVoto,
  fuenteId: number | null,
): boolean {
  const existente = db
    .select({ id: resolucionesAfiliacion.id })
    .from(resolucionesAfiliacion)
    .where(
      and(
        eq(resolucionesAfiliacion.legisladorId, legisladorId),
        eq(resolucionesAfiliacion.partidoId, partidoId),
        eq(resolucionesAfiliacion.metodo, metodo),
        eq(resolucionesAfiliacion.nivelConfianza, nivelConfianza),
      ),
    )
    .get()

  if (existente) return false

  db.insert(resolucionesAfiliacion)
    .values({
      legisladorId,
      partidoId,
      metodo,
      nivelConfianza,
      fuenteId,
    })
    .run()
  return true
}

function resolverLegisladorExistente(
  db: DB,
  nombre: string,
  legislaturaId: number,
  camara: Camara,
): LegisladorConAlias | null {
  const contexto = obtenerLegisladoresContexto(db, legislaturaId, camara)
  const id = buscarLegisladorConAlias(nombre, contexto)
  if (id === null) return null
  return contexto.find((legislador) => legislador.id === id) ?? null
}

function crearLegislador(
  db: DB,
  registro: RegistroAfiliacionFuente,
  legislaturaId: number,
  partidoId: number,
  origenPartido: OrigenPartidoLegislador,
): number {
  return db
    .insert(legisladores)
    .values({
      nombre: registro.nombre.trim(),
      legislaturaId,
      partidoId,
      camara: registro.camara,
      departamento: registro.departamento,
      origenPartido,
    })
    .returning({ id: legisladores.id })
    .get().id
}

function actualizarLegislador(
  db: DB,
  legisladorId: number,
  partidoId: number,
  origenPartido: OrigenPartidoLegislador,
  departamento?: string,
) {
  db.update(legisladores)
    .set({
      partidoId,
      origenPartido,
      departamento: departamento ?? null,
    })
    .where(eq(legisladores.id, legisladorId))
    .run()
}

function debeCrearLegisladorDesdeRegistro(registro: RegistroAfiliacionFuente): boolean {
  const esSenadoHistorico =
    registro.camara === 'senado' &&
    registro.legislatura >= 46 &&
    registro.legislatura <= 49 &&
    registro.fuente.url.includes('/integracionhistorica/')

  return !esSenadoHistorico
}

function aplicarRegistroAfiliacion(
  db: DB,
  registro: RegistroAfiliacionFuente,
): {
  creado: boolean
  actualizado: boolean
  aliasRegistrados: number
  resolucionesRegistradas: number
  sinAsignar: boolean
} {
  const legislaturaId = obtenerLegislaturaId(db, registro.legislatura)
  const fuenteId = obtenerFuenteId(db, registro.fuente.tipo, registro.fuente.url)
  const siglaPartido = resolverSiglaPartido(registro.siglaPartido)
  const partidoId = siglaPartido
    ? (obtenerPartidoIdPorSigla(db, siglaPartido) ?? obtenerPartidoSinAsignar(db))
    : obtenerPartidoSinAsignar(db)
  const metodo = siglaPartido ? registro.metodo : 'sin_asignar'
  const origenPartido = origenDesdeMetodo(metodo)

  const existente = resolverLegisladorExistente(
    db,
    registro.nombre,
    legislaturaId,
    registro.camara,
  )

  let legisladorId = existente?.id ?? null
  let creado = false
  let actualizado = false
  let aliasRegistrados = 0
  let resolucionesRegistradas = 0

  if (!legisladorId) {
    if (!debeCrearLegisladorDesdeRegistro(registro)) {
      return {
        creado: false,
        actualizado: false,
        aliasRegistrados: 0,
        resolucionesRegistradas: 0,
        sinAsignar: false,
      }
    }
    legisladorId = crearLegislador(db, registro, legislaturaId, partidoId, origenPartido)
    creado = true
  } else {
    const mejorActual = obtenerMejorResolucionActual(db, legisladorId)
    const debeActualizar = debeActualizarResolucion(mejorActual, {
      metodo,
      nivelConfianza: registro.nivelConfianza,
    })

    if (debeActualizar) {
      actualizarLegislador(
        db,
        legisladorId,
        partidoId,
        origenPartido,
        registro.departamento,
      )
      actualizado = true
    }
  }

  for (const alias of new Set([registro.nombre, ...(registro.alias ?? [])])) {
    if (registrarAlias(db, legisladorId, alias, registro.nivelConfianza, fuenteId)) {
      aliasRegistrados++
    }
  }

  if (
    registrarResolucion(db, legisladorId, partidoId, metodo, registro.nivelConfianza, fuenteId)
  ) {
    resolucionesRegistradas++
  }

  return {
    creado,
    actualizado,
    aliasRegistrados,
    resolucionesRegistradas,
    sinAsignar: partidoId === obtenerPartidoSinAsignar(db),
  }
}

export function reconciliarAfiliacionesPorAlias(db: DB, opciones?: {
  legislaturas?: number[]
  camara?: Camara
}): number {
  const partidoSa = obtenerPartidoSinAsignar(db)
  const filas = db
    .select({
      id: legisladores.id,
      nombre: legisladores.nombre,
      legislaturaId: legisladores.legislaturaId,
      camara: legisladores.camara,
    })
    .from(legisladores)
    .where(
      and(
        eq(legisladores.partidoId, partidoSa),
        ...(opciones?.camara ? [eq(legisladores.camara, opciones.camara)] : []),
      ),
    )
    .all()

  const mapaLegislaturas = new Map(
    db
      .select({ id: legislaturas.id, numero: legislaturas.numero })
      .from(legislaturas)
      .all()
      .map((legislatura) => [legislatura.id, legislatura.numero]),
  )

  const candidatos = filas.filter((candidato) =>
    opciones?.legislaturas?.length
      ? opciones.legislaturas.includes(mapaLegislaturas.get(candidato.legislaturaId) ?? -1)
      : true,
  )

  let reconciliados = 0
  for (const candidato of candidatos) {
    const universo = obtenerLegisladoresContexto(db, candidato.legislaturaId, candidato.camara).filter(
      (legislador) => legislador.partidoId !== partidoSa && legislador.id !== candidato.id,
    )
    const matchId = buscarLegisladorConAlias(candidato.nombre, universo)
    if (matchId === null) continue

    const destino = universo.find((legislador) => legislador.id === matchId)
    if (!destino) continue

    actualizarLegislador(db, candidato.id, destino.partidoId, 'inferido')
    registrarAlias(db, candidato.id, destino.nombre, 'alto', null)
    registrarResolucion(
      db,
      candidato.id,
      destino.partidoId,
      'inferido_por_alias',
      'alto',
      null,
    )
    reconciliados++
  }

  return reconciliados
}

export function reconciliarAfiliacionesEntreLegislaturas(db: DB, opciones?: {
  legislaturas?: number[]
  camara?: Camara
}): number {
  const partidoSa = obtenerPartidoSinAsignar(db)
  const candidatos = db
    .select({
      id: legisladores.id,
      nombre: legisladores.nombre,
      legislaturaId: legisladores.legislaturaId,
      camara: legisladores.camara,
    })
    .from(legisladores)
    .where(
      and(
        eq(legisladores.partidoId, partidoSa),
        ...(opciones?.camara ? [eq(legisladores.camara, opciones.camara)] : []),
      ),
    )
    .all()

  const mapaLegislaturas = new Map(
    db
      .select({ id: legislaturas.id, numero: legislaturas.numero })
      .from(legislaturas)
      .all()
      .map((legislatura) => [legislatura.id, legislatura.numero]),
  )

  let reconciliados = 0
  for (const candidato of candidatos) {
    const numeroLegislatura = mapaLegislaturas.get(candidato.legislaturaId) ?? -1
    if (opciones?.legislaturas?.length && !opciones.legislaturas.includes(numeroLegislatura)) {
      continue
    }

    const universo = db
      .select({
        id: legisladores.id,
        nombre: legisladores.nombre,
        legislaturaId: legisladores.legislaturaId,
        partidoId: legisladores.partidoId,
        origenPartido: legisladores.origenPartido,
      })
      .from(legisladores)
      .where(
        and(
          eq(legisladores.camara, candidato.camara),
          ne(legisladores.partidoId, partidoSa),
        ),
      )
      .all()
      .filter((legislador) => legislador.id !== candidato.id)
      .map((legislador) => ({
        ...legislador,
        alias: [legislador.nombre],
      }))

    const matchId = buscarLegisladorConAlias(candidato.nombre, universo)
    if (matchId === null) continue
    const destino = universo.find((legislador) => legislador.id === matchId)
    if (!destino) continue

    actualizarLegislador(db, candidato.id, destino.partidoId, 'inferido')
    registrarAlias(db, candidato.id, destino.nombre, 'medio', null)
    registrarResolucion(
      db,
      candidato.id,
      destino.partidoId,
      'inferido_por_alias',
      'medio',
      null,
    )
    reconciliados++
  }

  return reconciliados
}

export function obtenerReporteCoberturaAfiliaciones(db: DB): ReporteCoberturaAfiliacion[] {
  const partidoSa = obtenerPartidoSinAsignar(db)
  const filas = db
    .select({
      nombre: legisladores.nombre,
      camara: legisladores.camara,
      legislatura: legislaturas.numero,
      partidoId: legisladores.partidoId,
    })
    .from(legisladores)
    .innerJoin(legislaturas, eq(legisladores.legislaturaId, legislaturas.id))
    .orderBy(asc(legislaturas.numero), asc(legisladores.camara))
    .all()

  const mapa = new Map<string, ReporteCoberturaAfiliacion>()
  for (const fila of filas) {
    const clave = `${fila.legislatura}-${fila.camara}`
    const actual = mapa.get(clave) ?? {
      camara: fila.camara,
      legislatura: fila.legislatura,
      total: 0,
      resueltos: 0,
      sinAsignar: 0,
      porcentajeCobertura: 0,
      pendientes: [],
    }
    actual.total++
    if (fila.partidoId === partidoSa) {
      actual.sinAsignar++
      if (actual.pendientes.length < 10) {
        actual.pendientes.push(fila.nombre)
      }
    } else {
      actual.resueltos++
    }
    actual.porcentajeCobertura =
      actual.total > 0 ? Math.round((actual.resueltos / actual.total) * 100) : 0
    mapa.set(clave, actual)
  }

  return [...mapa.values()]
}

export async function cargarAfiliacionesHistoricas(
  db: DB,
  opciones: { camara?: Camara; legislaturas?: number[]; incluirCurado?: boolean } = {},
): Promise<ResultadoCargaAfiliaciones> {
  const registros = await obtenerRegistrosAfiliacionPorFuente(opciones)
  const resultado: ResultadoCargaAfiliaciones = {
    registrosProcesados: 0,
    legisladoresCreados: 0,
    legisladoresActualizados: 0,
    aliasRegistrados: 0,
    resolucionesRegistradas: 0,
    sinAsignar: 0,
    reconciliadosInterlegislatura: 0,
    reportes: [],
  }

  for (const registro of registros) {
    const aplicacion = aplicarRegistroAfiliacion(db, registro)
    resultado.registrosProcesados++
    if (aplicacion.creado) resultado.legisladoresCreados++
    if (aplicacion.actualizado) resultado.legisladoresActualizados++
    resultado.aliasRegistrados += aplicacion.aliasRegistrados
    resultado.resolucionesRegistradas += aplicacion.resolucionesRegistradas
    if (aplicacion.sinAsignar) resultado.sinAsignar++
  }

  reconciliarAfiliacionesPorAlias(db, opciones)
  resultado.reconciliadosInterlegislatura = reconciliarAfiliacionesEntreLegislaturas(
    db,
    opciones,
  )
  resultado.reportes = obtenerReporteCoberturaAfiliaciones(db)

  return resultado
}

export function resolverLegisladorPorContexto(
  db: DB,
  nombre: string,
  legislaturaId: number,
  camara: Camara,
): number | null {
  return resolverLegisladorExistente(db, nombre, legislaturaId, camara)?.id ?? null
}
