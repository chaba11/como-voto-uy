import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { db } from './db'
import {
  asuntos,
  legisladores,
  partidos,
  resultadosAgregados,
  sesiones,
  votaciones,
  votosIndividuales,
} from '@como-voto-uy/shared'

const nivelesRanking: Array<'confirmado' | 'alto'> = ['confirmado', 'alto']

export async function obtenerEstadisticasGlobales() {
  if (!db) {
    return {
      totalLegisladores: 0,
      totalAsuntos: 0,
      totalVotosIndividuales: 0,
      totalSesiones: 0,
    }
  }

  const [legCount, asuntoCount, votoCount, sesionCount] = await Promise.all([
    db.select({ total: count() }).from(legisladores),
    db.select({ total: count() }).from(asuntos),
    db
      .select({ total: count() })
      .from(votosIndividuales)
      .where(inArray(votosIndividuales.nivelConfianza, ['confirmado', 'alto', 'medio'] as const)),
    db.select({ total: count() }).from(sesiones),
  ])

  return {
    totalLegisladores: legCount[0]?.total ?? 0,
    totalAsuntos: asuntoCount[0]?.total ?? 0,
    totalVotosIndividuales: votoCount[0]?.total ?? 0,
    totalSesiones: sesionCount[0]?.total ?? 0,
  }
}

export async function obtenerLeyesDivididas(limite = 10) {
  if (!db) return []

  const filas = await db
    .select({
      asuntoId: asuntos.id,
      tituloPublico: asuntos.tituloPublico,
      fecha: sesiones.fecha,
      cuerpo: sesiones.cuerpo,
      afirmativos: resultadosAgregados.afirmativos,
      negativos: resultadosAgregados.negativos,
      totalPresentes: resultadosAgregados.totalPresentes,
    })
    .from(votaciones)
    .innerJoin(asuntos, eq(votaciones.asuntoId, asuntos.id))
    .innerJoin(sesiones, eq(votaciones.sesionId, sesiones.id))
    .innerJoin(resultadosAgregados, eq(resultadosAgregados.votacionId, votaciones.id))
    .where(and(eq(votaciones.estadoCobertura, 'individual_confirmado')))
    .orderBy(desc(sesiones.fecha))

  return filas
    .filter((fila) => (fila.negativos ?? 0) > 0)
    .sort((a, b) => Math.abs((a.afirmativos ?? 0) - (a.negativos ?? 0)) - Math.abs((b.afirmativos ?? 0) - (b.negativos ?? 0)))
    .slice(0, limite)
}

export async function calcularAfinidadPartidos() {
  if (!db) return []

  const votos = await db
    .select({
      votacionId: votosIndividuales.votacionId,
      partidoId: partidos.id,
      partidoSigla: partidos.sigla,
      partidoColor: partidos.color,
      voto: votosIndividuales.voto,
    })
    .from(votosIndividuales)
    .innerJoin(legisladores, eq(votosIndividuales.legisladorId, legisladores.id))
    .innerJoin(partidos, eq(legisladores.partidoId, partidos.id))
    .where(inArray(votosIndividuales.nivelConfianza, nivelesRanking))

  const partidosMap = new Map<number, { sigla: string; color: string }>()
  const mayorias = new Map<string, string>()
  const conteos = new Map<string, Record<string, number>>()

  for (const voto of votos) {
    partidosMap.set(voto.partidoId, { sigla: voto.partidoSigla, color: voto.partidoColor })
    const clave = `${voto.votacionId}:${voto.partidoId}`
    const actual = conteos.get(clave) ?? {}
    actual[voto.voto] = (actual[voto.voto] ?? 0) + 1
    conteos.set(clave, actual)
  }

  for (const [clave, conteo] of conteos.entries()) {
    const mayoria = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (mayoria) mayorias.set(clave, mayoria)
  }

  const partidosLista = [...partidosMap.entries()].map(([id, info]) => ({ id, ...info }))
  const afinidad: { partido1: string; partido2: string; color1: string; color2: string; porcentaje: number }[] = []

  for (let i = 0; i < partidosLista.length; i++) {
    for (let j = i; j < partidosLista.length; j++) {
      const p1 = partidosLista[i]
      const p2 = partidosLista[j]
      let coincidencias = 0
      let total = 0

      const votacionesIds = new Set(votos.map((voto) => voto.votacionId))
      for (const votacionId of votacionesIds) {
        const voto1 = mayorias.get(`${votacionId}:${p1.id}`)
        const voto2 = mayorias.get(`${votacionId}:${p2.id}`)
        if (!voto1 || !voto2) continue
        total++
        if (voto1 === voto2) coincidencias++
      }

      afinidad.push({
        partido1: p1.sigla,
        partido2: p2.sigla,
        color1: p1.color,
        color2: p2.color,
        porcentaje: total > 0 ? Math.round((coincidencias / total) * 100) : 0,
      })
    }
  }

  return afinidad
}

export async function obtenerRankingParticipacion(filtros?: {
  camara?: string
  partidoId?: number
  departamento?: string
}) {
  if (!db) return []

  const condiciones = []
  if (filtros?.camara) condiciones.push(eq(legisladores.camara, filtros.camara as never))
  if (filtros?.partidoId) condiciones.push(eq(legisladores.partidoId, filtros.partidoId))
  if (filtros?.departamento) condiciones.push(eq(legisladores.departamento, filtros.departamento))

  const legisladoresBase = await db
    .select({
      legisladorId: legisladores.id,
      nombre: legisladores.nombre,
      camara: legisladores.camara,
      departamento: legisladores.departamento,
      partidoNombre: partidos.nombre,
      partidoSigla: partidos.sigla,
      partidoColor: partidos.color,
    })
    .from(legisladores)
    .innerJoin(partidos, eq(legisladores.partidoId, partidos.id))
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)

  const votos = await db
    .select({
      legisladorId: votosIndividuales.legisladorId,
      voto: votosIndividuales.voto,
    })
    .from(votosIndividuales)
    .where(inArray(votosIndividuales.nivelConfianza, nivelesRanking))

  return legisladoresBase
    .map((legislador) => {
      const votosLeg = votos.filter((voto) => voto.legisladorId === legislador.legisladorId)
      const presentes = votosLeg.filter((voto) => voto.voto !== 'ausente').length
      const totalVotos = votosLeg.length
      return {
        ...legislador,
        totalVotos,
        participacion: totalVotos > 0 ? Math.round((presentes / totalVotos) * 100) : 0,
      }
    })
    .sort((a, b) => b.participacion - a.participacion || b.totalVotos - a.totalVotos)
    .map((fila, indice) => ({
      rank: indice + 1,
      ...fila,
    }))
}
