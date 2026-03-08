import { eq, like, and, sql, desc, count } from 'drizzle-orm'
import { db } from './db'
import {
  legisladores,
  votos,
  proyectosLey,
  sesiones,
  partidos,
  legislaturas,
} from '@como-voto-uy/shared'

export async function obtenerLegislador(id: number) {
  if (!db) return null
  const resultado = await db
    .select({
      id: legisladores.id,
      nombre: legisladores.nombre,
      camara: legisladores.camara,
      departamento: legisladores.departamento,
      titularId: legisladores.titularId,
      partidoId: legisladores.partidoId,
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

  let titular = null
  if (leg.titularId) {
    const titularRes = await db
      .select({ id: legisladores.id, nombre: legisladores.nombre })
      .from(legisladores)
      .where(eq(legisladores.id, leg.titularId))
      .limit(1)
    titular = titularRes[0] || null
  }

  return {
    id: leg.id,
    nombre: leg.nombre,
    camara: leg.camara,
    departamento: leg.departamento,
    titularId: leg.titularId,
    partido: {
      id: leg.partidoId,
      nombre: leg.partidoNombre,
      sigla: leg.partidoSigla,
      color: leg.partidoColor,
    },
    titular,
  }
}

export async function obtenerVotosPorLegislador(legisladorId: number) {
  if (!db) return []
  return await db
    .select({
      id: votos.id,
      voto: votos.voto,
      proyectoLeyId: proyectosLey.id,
      proyectoNombre: proyectosLey.nombre,
      fecha: sesiones.fecha,
      camara: sesiones.camara,
    })
    .from(votos)
    .innerJoin(proyectosLey, eq(votos.proyectoLeyId, proyectosLey.id))
    .innerJoin(sesiones, eq(proyectosLey.sesionId, sesiones.id))
    .where(eq(votos.legisladorId, legisladorId))
    .orderBy(desc(sesiones.fecha))
}

export async function obtenerVotosPorProyecto(proyectoId: number) {
  if (!db) return []
  return await db
    .select({
      id: votos.id,
      voto: votos.voto,
      legisladorId: legisladores.id,
      legisladorNombre: legisladores.nombre,
      partidoId: partidos.id,
      partidoNombre: partidos.nombre,
      partidoSigla: partidos.sigla,
      partidoColor: partidos.color,
    })
    .from(votos)
    .innerJoin(legisladores, eq(votos.legisladorId, legisladores.id))
    .innerJoin(partidos, eq(legisladores.partidoId, partidos.id))
    .where(eq(votos.proyectoLeyId, proyectoId))
    .orderBy(partidos.nombre, legisladores.nombre)
}

export async function buscarLegisladores(filtros: {
  partido?: number
  departamento?: string
  termino?: string
}) {
  if (!db) return []

  const condiciones = []
  if (filtros.partido) {
    condiciones.push(eq(legisladores.partidoId, filtros.partido))
  }
  if (filtros.departamento) {
    condiciones.push(eq(legisladores.departamento, filtros.departamento))
  }
  if (filtros.termino) {
    condiciones.push(like(legisladores.nombre, `%${filtros.termino}%`))
  }

  return await db
    .select({
      id: legisladores.id,
      nombre: legisladores.nombre,
      camara: legisladores.camara,
      departamento: legisladores.departamento,
      titularId: legisladores.titularId,
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

export async function buscarLeyes(filtros: {
  año?: number
  camara?: string
  termino?: string
}) {
  if (!db) return []

  const condiciones = []
  if (filtros.camara) {
    condiciones.push(eq(sesiones.camara, filtros.camara as 'senado' | 'representantes'))
  }
  if (filtros.termino) {
    condiciones.push(like(proyectosLey.nombre, `%${filtros.termino}%`))
  }
  if (filtros.año) {
    condiciones.push(like(sesiones.fecha, `${filtros.año}%`))
  }

  return await db
    .select({
      id: proyectosLey.id,
      nombre: proyectosLey.nombre,
      descripcion: proyectosLey.descripcion,
      tema: proyectosLey.tema,
      fecha: sesiones.fecha,
      camara: sesiones.camara,
    })
    .from(proyectosLey)
    .innerJoin(sesiones, eq(proyectosLey.sesionId, sesiones.id))
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    .orderBy(desc(sesiones.fecha))
    .limit(50)
}

export async function obtenerLeyesRecientes(limite: number = 10) {
  if (!db) return []
  return await db
    .select({
      id: proyectosLey.id,
      nombre: proyectosLey.nombre,
      descripcion: proyectosLey.descripcion,
      tema: proyectosLey.tema,
      fecha: sesiones.fecha,
      camara: sesiones.camara,
    })
    .from(proyectosLey)
    .innerJoin(sesiones, eq(proyectosLey.sesionId, sesiones.id))
    .orderBy(desc(sesiones.fecha))
    .limit(limite)
}

export async function obtenerPartidos() {
  if (!db) return []
  return await db.select().from(partidos).orderBy(partidos.nombre)
}

export async function obtenerEstadisticasLegislador(legisladorId: number) {
  if (!db) return null

  const resultado = await db
    .select({
      total: count(),
      afirmativos: count(
        sql`CASE WHEN ${votos.voto} = 'afirmativo' THEN 1 END`
      ),
      negativos: count(
        sql`CASE WHEN ${votos.voto} = 'negativo' THEN 1 END`
      ),
      ausentes: count(
        sql`CASE WHEN ${votos.voto} = 'ausente' THEN 1 END`
      ),
    })
    .from(votos)
    .where(eq(votos.legisladorId, legisladorId))

  if (resultado.length === 0 || resultado[0].total === 0) {
    return {
      legisladorId,
      totalVotos: 0,
      afirmativos: 0,
      negativos: 0,
      ausentes: 0,
      porcentajeAsistencia: 0,
    }
  }

  const stats = resultado[0]
  const presentes = stats.afirmativos + stats.negativos

  return {
    legisladorId,
    totalVotos: stats.total,
    afirmativos: stats.afirmativos,
    negativos: stats.negativos,
    ausentes: stats.ausentes,
    porcentajeAsistencia:
      stats.total > 0 ? Math.round((presentes / stats.total) * 100) : 0,
  }
}
