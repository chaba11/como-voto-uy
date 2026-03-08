import { eq, sql, desc, count, and } from 'drizzle-orm'
import { db } from './db'
import {
  legisladores,
  votos,
  proyectosLey,
  sesiones,
  partidos,
} from '@como-voto-uy/shared'

/**
 * Alineamiento partidario: % de veces que un legislador vota con la mayoría de su partido
 */
export async function calcularAlineamiento(legisladorId: number): Promise<number> {
  if (!db) return 0

  // Get the legislador's party
  const legResult = await db
    .select({ partidoId: legisladores.partidoId })
    .from(legisladores)
    .where(eq(legisladores.id, legisladorId))
    .limit(1)

  if (legResult.length === 0) return 0
  const partidoId = legResult[0].partidoId

  // Get all votes by this legislador (excluding ausente)
  const votosLeg = await db
    .select({
      proyectoLeyId: votos.proyectoLeyId,
      voto: votos.voto,
    })
    .from(votos)
    .where(eq(votos.legisladorId, legisladorId))

  if (votosLeg.length === 0) return 0

  let alineados = 0
  let total = 0

  for (const votoLeg of votosLeg) {
    if (votoLeg.voto === 'ausente') continue

    // Get party majority for this proyecto
    const mayoriaPartido = await db
      .select({
        voto: votos.voto,
        cantidad: count(),
      })
      .from(votos)
      .innerJoin(legisladores, eq(votos.legisladorId, legisladores.id))
      .where(
        and(
          eq(votos.proyectoLeyId, votoLeg.proyectoLeyId),
          eq(legisladores.partidoId, partidoId),
          sql`${votos.voto} != 'ausente'`
        )
      )
      .groupBy(votos.voto)
      .orderBy(desc(count()))
      .limit(1)

    if (mayoriaPartido.length > 0 && votoLeg.voto === mayoriaPartido[0].voto) {
      alineados++
    }
    total++
  }

  return total > 0 ? Math.round((alineados / total) * 100) : 0
}

/**
 * Leyes más divididas: proyectos con menor margen entre afirmativos y negativos
 */
export async function obtenerLeyesDivididas(limite: number = 10) {
  if (!db) return []

  const resultado = await db
    .select({
      proyectoId: proyectosLey.id,
      nombre: proyectosLey.nombre,
      fecha: sesiones.fecha,
      camara: sesiones.camara,
      afirmativos: sql<number>`SUM(CASE WHEN ${votos.voto} = 'afirmativo' THEN 1 ELSE 0 END)`,
      negativos: sql<number>`SUM(CASE WHEN ${votos.voto} = 'negativo' THEN 1 ELSE 0 END)`,
      ausentes: sql<number>`SUM(CASE WHEN ${votos.voto} = 'ausente' THEN 1 ELSE 0 END)`,
      total: count(),
    })
    .from(votos)
    .innerJoin(proyectosLey, eq(votos.proyectoLeyId, proyectosLey.id))
    .innerJoin(sesiones, eq(proyectosLey.sesionId, sesiones.id))
    .groupBy(proyectosLey.id)
    .having(sql`SUM(CASE WHEN ${votos.voto} = 'negativo' THEN 1 ELSE 0 END) > 0`)
    .orderBy(
      sql`ABS(SUM(CASE WHEN ${votos.voto} = 'afirmativo' THEN 1 ELSE 0 END) - SUM(CASE WHEN ${votos.voto} = 'negativo' THEN 1 ELSE 0 END))`
    )
    .limit(limite)

  return resultado
}

/**
 * Asistencia: % de sesiones donde el legislador votó (no ausente)
 */
export async function calcularAsistencia(legisladorId: number): Promise<number> {
  if (!db) return 0

  const resultado = await db
    .select({
      total: count(),
      presentes: sql<number>`SUM(CASE WHEN ${votos.voto} != 'ausente' THEN 1 ELSE 0 END)`,
    })
    .from(votos)
    .where(eq(votos.legisladorId, legisladorId))

  if (resultado.length === 0 || resultado[0].total === 0) return 0
  return Math.round((resultado[0].presentes / resultado[0].total) * 100)
}

/**
 * Afinidad inter-partido: con qué frecuencia dos partidos votan igual
 */
export async function calcularAfinidadPartidos() {
  if (!db) return []

  // Get all parties
  const partidosList = await db.select().from(partidos).orderBy(partidos.nombre)

  // For each proyecto, determine each party's majority vote
  const votosPartido = await db
    .select({
      proyectoLeyId: votos.proyectoLeyId,
      partidoId: legisladores.partidoId,
      voto: votos.voto,
      cantidad: count(),
    })
    .from(votos)
    .innerJoin(legisladores, eq(votos.legisladorId, legisladores.id))
    .where(sql`${votos.voto} != 'ausente'`)
    .groupBy(votos.proyectoLeyId, legisladores.partidoId, votos.voto)

  // Build majority vote per partido per proyecto
  const mayorias: Record<string, Record<number, string>> = {}
  for (const row of votosPartido) {
    const key = `${row.proyectoLeyId}`
    if (!mayorias[key]) mayorias[key] = {}
    const current = mayorias[key][row.partidoId]
    if (!current) {
      mayorias[key][row.partidoId] = row.voto
    }
    // Keep the one with higher count (rows come ungrouped by max, so track)
  }

  // Re-process to get actual majority per partido per proyecto
  const conteos: Record<string, Record<number, Record<string, number>>> = {}
  for (const row of votosPartido) {
    const pKey = `${row.proyectoLeyId}`
    if (!conteos[pKey]) conteos[pKey] = {}
    if (!conteos[pKey][row.partidoId]) conteos[pKey][row.partidoId] = {}
    conteos[pKey][row.partidoId][row.voto] = row.cantidad
  }

  const mayoriaFinal: Record<string, Record<number, string>> = {}
  for (const [pKey, partidosMap] of Object.entries(conteos)) {
    mayoriaFinal[pKey] = {}
    for (const [partidoIdStr, votosMap] of Object.entries(partidosMap)) {
      let maxVoto = ''
      let maxCount = 0
      for (const [voto, cnt] of Object.entries(votosMap)) {
        if (cnt > maxCount) {
          maxCount = cnt
          maxVoto = voto
        }
      }
      mayoriaFinal[pKey][parseInt(partidoIdStr)] = maxVoto
    }
  }

  // Calculate agreement between each pair of parties
  const afinidad: { partido1: string; partido2: string; color1: string; color2: string; porcentaje: number }[] = []

  for (let i = 0; i < partidosList.length; i++) {
    for (let j = i; j < partidosList.length; j++) {
      const p1 = partidosList[i]
      const p2 = partidosList[j]
      let coincidencias = 0
      let totalComparados = 0

      for (const [, partidosMap] of Object.entries(mayoriaFinal)) {
        if (partidosMap[p1.id] && partidosMap[p2.id]) {
          totalComparados++
          if (partidosMap[p1.id] === partidosMap[p2.id]) {
            coincidencias++
          }
        }
      }

      afinidad.push({
        partido1: p1.sigla,
        partido2: p2.sigla,
        color1: p1.color,
        color2: p2.color,
        porcentaje: totalComparados > 0 ? Math.round((coincidencias / totalComparados) * 100) : 0,
      })
    }
  }

  return afinidad
}

/**
 * Ranking de participación
 */
export async function obtenerRankingParticipacion(filtros?: {
  camara?: string
  partidoId?: number
  departamento?: string
}) {
  if (!db) return []

  const condiciones = []
  if (filtros?.camara) {
    condiciones.push(eq(legisladores.camara, filtros.camara as 'senado' | 'representantes'))
  }
  if (filtros?.partidoId) {
    condiciones.push(eq(legisladores.partidoId, filtros.partidoId))
  }
  if (filtros?.departamento) {
    condiciones.push(eq(legisladores.departamento, filtros.departamento))
  }

  const resultado = await db
    .select({
      legisladorId: legisladores.id,
      nombre: legisladores.nombre,
      camara: legisladores.camara,
      departamento: legisladores.departamento,
      partidoNombre: partidos.nombre,
      partidoSigla: partidos.sigla,
      partidoColor: partidos.color,
      totalVotos: count(),
      presentes: sql<number>`SUM(CASE WHEN ${votos.voto} != 'ausente' THEN 1 ELSE 0 END)`,
    })
    .from(legisladores)
    .innerJoin(partidos, eq(legisladores.partidoId, partidos.id))
    .innerJoin(votos, eq(votos.legisladorId, legisladores.id))
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    .groupBy(legisladores.id)
    .orderBy(desc(sql`SUM(CASE WHEN ${votos.voto} != 'ausente' THEN 1 ELSE 0 END) * 1.0 / COUNT(*)`))

  return resultado.map((r, i) => ({
    rank: i + 1,
    legisladorId: r.legisladorId,
    nombre: r.nombre,
    camara: r.camara,
    departamento: r.departamento,
    partidoNombre: r.partidoNombre,
    partidoSigla: r.partidoSigla,
    partidoColor: r.partidoColor,
    totalVotos: r.totalVotos,
    participacion: r.totalVotos > 0 ? Math.round((r.presentes / r.totalVotos) * 100) : 0,
  }))
}

/**
 * Estadísticas globales
 */
export async function obtenerEstadisticasGlobales() {
  if (!db) return { totalLegisladores: 0, totalProyectos: 0, totalVotos: 0, totalSesiones: 0 }

  const [legCount, proyCount, votoCount, sesionCount] = await Promise.all([
    db.select({ total: count() }).from(legisladores),
    db.select({ total: count() }).from(proyectosLey),
    db.select({ total: count() }).from(votos),
    db.select({ total: count() }).from(sesiones),
  ])

  return {
    totalLegisladores: legCount[0]?.total ?? 0,
    totalProyectos: proyCount[0]?.total ?? 0,
    totalVotos: votoCount[0]?.total ?? 0,
    totalSesiones: sesionCount[0]?.total ?? 0,
  }
}
