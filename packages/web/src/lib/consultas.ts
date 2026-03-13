import { and, count, desc, eq, inArray, like, or } from 'drizzle-orm'
import { db } from './db'
import {
  aliasLegisladores,
  asuntos,
  fuentes,
  legisladores,
  partidos,
  resultadosAgregados,
  resolucionesAfiliacion,
  sesiones,
  votaciones,
  votosIndividuales,
} from '@como-voto-uy/shared'

const nivelesPublicos: Array<'confirmado' | 'alto' | 'medio'> = ['confirmado', 'alto', 'medio']
const nivelesRanking: Array<'confirmado' | 'alto'> = ['confirmado', 'alto']

export async function obtenerLegislador(id: number) {
  if (!db) return null

  const resultado = await db
    .select({
      id: legisladores.id,
      nombre: legisladores.nombre,
      legislaturaId: legisladores.legislaturaId,
      camara: legisladores.camara,
      departamento: legisladores.departamento,
      origenPartido: legisladores.origenPartido,
      titularId: legisladores.titularId,
      partidoId: partidos.id,
      partidoNombre: partidos.nombre,
      partidoSigla: partidos.sigla,
      partidoColor: partidos.color,
    })
    .from(legisladores)
    .innerJoin(partidos, eq(legisladores.partidoId, partidos.id))
    .where(eq(legisladores.id, id))
    .limit(1)

  if (resultado.length === 0) return null

  const leg = resultado[0]
  const titular = leg.titularId
    ? (
        await db
          .select({ id: legisladores.id, nombre: legisladores.nombre })
          .from(legisladores)
          .where(eq(legisladores.id, leg.titularId))
          .limit(1)
      )[0] ?? null
    : null

  const alias = await db
    .select({
      id: aliasLegisladores.id,
      legisladorId: aliasLegisladores.legisladorId,
      alias: aliasLegisladores.alias,
      nivelConfianza: aliasLegisladores.nivelConfianza,
      fuenteId: aliasLegisladores.fuenteId,
    })
    .from(aliasLegisladores)
    .where(eq(aliasLegisladores.legisladorId, id))

  const resoluciones = await db
    .select({
      id: resolucionesAfiliacion.id,
      partidoId: resolucionesAfiliacion.partidoId,
      metodo: resolucionesAfiliacion.metodo,
      nivelConfianza: resolucionesAfiliacion.nivelConfianza,
      fuenteId: resolucionesAfiliacion.fuenteId,
    })
    .from(resolucionesAfiliacion)
    .where(eq(resolucionesAfiliacion.legisladorId, id))

  return {
    id: leg.id,
    nombre: leg.nombre,
    legislaturaId: leg.legislaturaId,
    camara: leg.camara,
    departamento: leg.departamento,
    origenPartido: leg.origenPartido,
    partido: {
      id: leg.partidoId,
      nombre: leg.partidoNombre,
      sigla: leg.partidoSigla,
      color: leg.partidoColor,
    },
    titular,
    alias,
    resolucionesAfiliacion: resoluciones,
  }
}

export async function obtenerVotosPorLegislador(legisladorId: number) {
  if (!db) return []

  return await db
    .select({
      id: votosIndividuales.id,
      voto: votosIndividuales.voto,
      nivelConfianza: votosIndividuales.nivelConfianza,
      asuntoId: asuntos.id,
      asuntoNombre: asuntos.tituloPublico,
      fecha: sesiones.fecha,
      cuerpo: sesiones.cuerpo,
      fuenteTipo: fuentes.tipo,
      fuenteUrl: fuentes.url,
    })
    .from(votosIndividuales)
    .innerJoin(votaciones, eq(votosIndividuales.votacionId, votaciones.id))
    .innerJoin(sesiones, eq(votaciones.sesionId, sesiones.id))
    .leftJoin(asuntos, eq(votaciones.asuntoId, asuntos.id))
    .leftJoin(fuentes, eq(votosIndividuales.fuenteId, fuentes.id))
    .where(
      and(
        eq(votosIndividuales.legisladorId, legisladorId),
        inArray(votosIndividuales.nivelConfianza, nivelesPublicos),
      ),
    )
    .orderBy(desc(sesiones.fecha), desc(votaciones.ordenSesion))
}

export async function obtenerEstadisticasLegislador(legisladorId: number) {
  if (!db) return null

  const legislador = await obtenerLegislador(legisladorId)
  if (!legislador) return null

  const votos = await db
    .select({
      voto: votosIndividuales.voto,
      nivelConfianza: votosIndividuales.nivelConfianza,
      votacionId: votosIndividuales.votacionId,
    })
    .from(votosIndividuales)
    .where(
      and(
        eq(votosIndividuales.legisladorId, legisladorId),
        inArray(votosIndividuales.nivelConfianza, nivelesPublicos),
      ),
    )

  const totalCobertura = await db
    .select({ total: count() })
    .from(votaciones)
    .innerJoin(sesiones, eq(votaciones.sesionId, sesiones.id))
    .where(
      and(
        eq(sesiones.cuerpo, legislador.camara),
        eq(sesiones.legislaturaId, legislador.legislaturaId),
        inArray(votaciones.nivelConfianza, nivelesRanking),
      ),
    )

  const total = votos.length
  const confirmados = votos.filter((v) => v.nivelConfianza === 'confirmado').length
  const inferidos = votos.filter((v) => v.nivelConfianza !== 'confirmado').length
  const afirmativos = votos.filter((v) => v.voto === 'afirmativo').length
  const negativos = votos.filter((v) => v.voto === 'negativo').length
  const abstenciones = votos.filter((v) => v.voto === 'abstencion').length
  const ausentes = votos.filter((v) => v.voto === 'ausente').length
  const presentes = total - ausentes
  const denominadorCobertura = totalCobertura[0]?.total ?? 0

  return {
    legisladorId,
    totalVotosPublicos: total,
    confirmados,
    inferidos,
    afirmativos,
    negativos,
    abstenciones,
    ausentes,
    porcentajeCobertura:
      denominadorCobertura > 0
        ? Math.round((new Set(votos.map((v) => v.votacionId)).size / denominadorCobertura) * 100)
        : 0,
    porcentajeAsistencia: total > 0 ? Math.round((presentes / total) * 100) : 0,
  }
}

export async function buscarLegisladores(filtros: {
  partido?: number
  departamento?: string
  termino?: string
}) {
  if (!db) return []

  const condiciones = []
  if (filtros.partido) condiciones.push(eq(legisladores.partidoId, filtros.partido))
  if (filtros.departamento) condiciones.push(eq(legisladores.departamento, filtros.departamento))
  if (filtros.termino) condiciones.push(like(legisladores.nombre, `%${filtros.termino}%`))

  return await db
    .select({
      id: legisladores.id,
      nombre: legisladores.nombre,
      legislaturaId: legisladores.legislaturaId,
      camara: legisladores.camara,
      departamento: legisladores.departamento,
      origenPartido: legisladores.origenPartido,
      partidoId: partidos.id,
      partidoNombre: partidos.nombre,
      partidoSigla: partidos.sigla,
      partidoColor: partidos.color,
    })
    .from(legisladores)
    .innerJoin(partidos, eq(legisladores.partidoId, partidos.id))
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    .orderBy(legisladores.nombre)
    .limit(50)
}

type FilaAsuntoBusqueda = {
  id: number
  nombre: string
  tituloPublico: string
  origenTitulo: string
  calidadTitulo: string
  descripcion: string | null
  tema: string | null
  carpeta: string | null
  repartido: string | null
  numeroLey: string | null
  fecha: string
  cuerpo: string
  modalidad: string
  estadoCobertura: string
  resultado: 'afirmativa' | 'negativa' | null
  afirmativos: number | null
  negativos: number | null
  totalPresentes: number | null
  unanimidad: boolean | null
}

function deduplicarAsuntos(filas: FilaAsuntoBusqueda[]) {
  const mapa = new Map<number, FilaAsuntoBusqueda>()
  for (const fila of filas) {
    if (!mapa.has(fila.id)) mapa.set(fila.id, fila)
  }
  return [...mapa.values()]
}

export async function buscarLeyes(filtros: {
  año?: number
  cuerpo?: string
  termino?: string
}) {
  if (!db) return []

  const condiciones = []
  if (filtros.cuerpo) condiciones.push(eq(sesiones.cuerpo, filtros.cuerpo as never))
  if (filtros.termino) {
    condiciones.push(
      or(
        like(asuntos.tituloPublico, `%${filtros.termino}%`),
        like(asuntos.nombre, `%${filtros.termino}%`),
        like(asuntos.carpeta, `%${filtros.termino}%`),
        like(asuntos.repartido, `%${filtros.termino}%`),
        like(asuntos.numeroLey, `%${filtros.termino}%`),
        like(asuntos.codigoOficial, `%${filtros.termino}%`),
      )!,
    )
  }
  if (filtros.año) condiciones.push(like(sesiones.fecha, `${filtros.año}%`))

  const filas = await db
    .select({
      id: asuntos.id,
      nombre: asuntos.nombre,
      tituloPublico: asuntos.tituloPublico,
      origenTitulo: asuntos.origenTitulo,
      calidadTitulo: asuntos.calidadTitulo,
      descripcion: asuntos.descripcion,
      tema: asuntos.tema,
      carpeta: asuntos.carpeta,
      repartido: asuntos.repartido,
      numeroLey: asuntos.numeroLey,
      fecha: sesiones.fecha,
      cuerpo: sesiones.cuerpo,
      modalidad: votaciones.modalidad,
      estadoCobertura: votaciones.estadoCobertura,
      resultado: votaciones.resultado,
      afirmativos: resultadosAgregados.afirmativos,
      negativos: resultadosAgregados.negativos,
      totalPresentes: resultadosAgregados.totalPresentes,
      unanimidad: resultadosAgregados.unanimidad,
    })
    .from(asuntos)
    .innerJoin(votaciones, eq(votaciones.asuntoId, asuntos.id))
    .innerJoin(sesiones, eq(votaciones.sesionId, sesiones.id))
    .leftJoin(resultadosAgregados, eq(resultadosAgregados.votacionId, votaciones.id))
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    .orderBy(desc(sesiones.fecha), desc(votaciones.ordenSesion))
    .limit(100)

  return deduplicarAsuntos(filas)
}

export async function obtenerLeyesRecientes(limite = 10) {
  const filas = await buscarLeyes({})
  return filas.slice(0, limite)
}

export async function obtenerPartidos() {
  if (!db) return []
  return await db.select().from(partidos).orderBy(partidos.nombre)
}

export async function obtenerAsuntoConVotaciones(id: number) {
  if (!db) return null

  const asunto = (
    await db
      .select()
      .from(asuntos)
      .where(eq(asuntos.id, id))
      .limit(1)
  )[0]

  if (!asunto) return null

  const votacionesBase = await db
    .select({
      id: votaciones.id,
      asuntoCalidadTitulo: asuntos.calidadTitulo,
      cuerpo: sesiones.cuerpo,
      fecha: sesiones.fecha,
      sesionNumero: sesiones.numero,
      ordenSesion: votaciones.ordenSesion,
      modalidad: votaciones.modalidad,
      detalleTitulo: votaciones.detalleTitulo,
      estadoCobertura: votaciones.estadoCobertura,
      nivelConfianza: votaciones.nivelConfianza,
      esOficial: votaciones.esOficial,
      resultado: votaciones.resultado,
      afirmativos: resultadosAgregados.afirmativos,
      negativos: resultadosAgregados.negativos,
      abstenciones: resultadosAgregados.abstenciones,
      totalPresentes: resultadosAgregados.totalPresentes,
      unanimidad: resultadosAgregados.unanimidad,
      fuenteId: fuentes.id,
      fuenteTipo: fuentes.tipo,
      fuenteUrl: fuentes.url,
    })
    .from(votaciones)
    .innerJoin(sesiones, eq(votaciones.sesionId, sesiones.id))
    .leftJoin(asuntos, eq(votaciones.asuntoId, asuntos.id))
    .leftJoin(resultadosAgregados, eq(resultadosAgregados.votacionId, votaciones.id))
    .leftJoin(fuentes, eq(votaciones.fuentePrincipalId, fuentes.id))
    .where(eq(votaciones.asuntoId, id))
    .orderBy(desc(sesiones.fecha), desc(votaciones.ordenSesion))

  const votosBase = await db
    .select({
      id: votosIndividuales.id,
      votacionId: votosIndividuales.votacionId,
      voto: votosIndividuales.voto,
      nivelConfianza: votosIndividuales.nivelConfianza,
      esOficial: votosIndividuales.esOficial,
      legisladorId: legisladores.id,
      legisladorNombre: legisladores.nombre,
      legisladorLegislaturaId: legisladores.legislaturaId,
      legisladorCamara: legisladores.camara,
      legisladorDepartamento: legisladores.departamento,
      legisladorOrigenPartido: legisladores.origenPartido,
      partidoId: partidos.id,
      partidoNombre: partidos.nombre,
      partidoSigla: partidos.sigla,
      partidoColor: partidos.color,
      fuenteId: fuentes.id,
      fuenteTipo: fuentes.tipo,
      fuenteUrl: fuentes.url,
    })
    .from(votosIndividuales)
    .innerJoin(legisladores, eq(votosIndividuales.legisladorId, legisladores.id))
    .innerJoin(partidos, eq(legisladores.partidoId, partidos.id))
    .innerJoin(votaciones, eq(votosIndividuales.votacionId, votaciones.id))
    .leftJoin(fuentes, eq(votosIndividuales.fuenteId, fuentes.id))
    .where(
      and(
        eq(votaciones.asuntoId, id),
        inArray(votosIndividuales.nivelConfianza, nivelesPublicos),
      ),
    )

  return {
    ...asunto,
    votaciones: votacionesBase.map((fila) => ({
      id: fila.id,
      cuerpo: fila.cuerpo,
      fecha: fila.fecha,
      sesionNumero: fila.sesionNumero,
      ordenSesion: fila.ordenSesion,
      modalidad: fila.modalidad,
      detalleTitulo: fila.detalleTitulo,
      estadoCobertura: fila.estadoCobertura,
      nivelConfianza: fila.nivelConfianza,
      esOficial: !!fila.esOficial,
      resultado: fila.resultado,
      afirmativos: fila.afirmativos,
      negativos: fila.negativos,
      abstenciones: fila.abstenciones,
      totalPresentes: fila.totalPresentes,
      unanimidad: fila.unanimidad,
      fuente: fila.fuenteId
        ? {
            id: fila.fuenteId,
            tipo: fila.fuenteTipo!,
            url: fila.fuenteUrl!,
          }
        : null,
      votosIndividuales: votosBase
        .filter((voto) => voto.votacionId === fila.id)
        .map((voto) => ({
          id: voto.id,
          voto: voto.voto,
          nivelConfianza: voto.nivelConfianza as 'confirmado' | 'alto' | 'medio',
          esOficial: !!voto.esOficial,
          legislador: {
            id: voto.legisladorId,
            nombre: voto.legisladorNombre,
            legislaturaId: voto.legisladorLegislaturaId,
            camara: voto.legisladorCamara,
            departamento: voto.legisladorDepartamento,
            origenPartido: voto.legisladorOrigenPartido,
            partido: {
              id: voto.partidoId,
              nombre: voto.partidoNombre,
              sigla: voto.partidoSigla,
              color: voto.partidoColor,
            },
            titularId: null,
          },
          fuente: voto.fuenteId
            ? {
                id: voto.fuenteId,
                tipo: voto.fuenteTipo!,
                url: voto.fuenteUrl!,
              }
            : null,
          evidencias: [],
        })),
    })),
  }
}

export async function obtenerPartidoDetalle(id: number) {
  if (!db) return null

  const partido = (
    await db
      .select()
      .from(partidos)
      .where(eq(partidos.id, id))
      .limit(1)
  )[0]

  if (!partido) return null

  const miembros = await db
    .select({
      id: legisladores.id,
      nombre: legisladores.nombre,
      camara: legisladores.camara,
      departamento: legisladores.departamento,
    })
    .from(legisladores)
    .where(eq(legisladores.partidoId, id))
    .orderBy(legisladores.camara, legisladores.nombre)

  const votos = await db
    .select({
      voto: votosIndividuales.voto,
      asuntoId: asuntos.id,
      asuntoNombre: asuntos.tituloPublico,
      fecha: sesiones.fecha,
    })
    .from(votosIndividuales)
    .innerJoin(legisladores, eq(votosIndividuales.legisladorId, legisladores.id))
    .innerJoin(votaciones, eq(votosIndividuales.votacionId, votaciones.id))
    .leftJoin(asuntos, eq(votaciones.asuntoId, asuntos.id))
    .innerJoin(sesiones, eq(votaciones.sesionId, sesiones.id))
    .where(
      and(
        eq(legisladores.partidoId, id),
        inArray(votosIndividuales.nivelConfianza, nivelesRanking),
      ),
    )

  return {
    partido,
    miembros,
    votos,
  }
}
