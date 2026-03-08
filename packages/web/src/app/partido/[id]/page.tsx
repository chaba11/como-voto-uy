import { notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, sql, desc, count, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  partidos,
  legisladores,
  votos,
  proyectosLey,
  sesiones,
} from '@como-voto-uy/shared'

export default async function PaginaPartido({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const partidoId = parseInt(id, 10)
  if (isNaN(partidoId)) notFound()

  let partido: { id: number; nombre: string; sigla: string; color: string } | null = null
  let miembros: {
    id: number
    nombre: string
    camara: string
    departamento: string | null
  }[] = []
  let estadisticasVoto: { afirmativos: number; negativos: number; ausentes: number; total: number } = {
    afirmativos: 0,
    negativos: 0,
    ausentes: 0,
    total: 0,
  }
  let leyesDivididas: {
    proyectoId: number
    nombre: string
    fecha: string
    afirmativos: number
    negativos: number
  }[] = []

  try {
    if (!db) notFound()

    const partidoRes = await db
      .select()
      .from(partidos)
      .where(eq(partidos.id, partidoId))
      .limit(1)

    if (partidoRes.length === 0) notFound()
    partido = partidoRes[0]

    miembros = await db
      .select({
        id: legisladores.id,
        nombre: legisladores.nombre,
        camara: legisladores.camara,
        departamento: legisladores.departamento,
      })
      .from(legisladores)
      .where(eq(legisladores.partidoId, partidoId))
      .orderBy(legisladores.camara, legisladores.nombre)

    const statsRes = await db
      .select({
        afirmativos: sql<number>`SUM(CASE WHEN ${votos.voto} = 'afirmativo' THEN 1 ELSE 0 END)`,
        negativos: sql<number>`SUM(CASE WHEN ${votos.voto} = 'negativo' THEN 1 ELSE 0 END)`,
        ausentes: sql<number>`SUM(CASE WHEN ${votos.voto} = 'ausente' THEN 1 ELSE 0 END)`,
        total: count(),
      })
      .from(votos)
      .innerJoin(legisladores, eq(votos.legisladorId, legisladores.id))
      .where(eq(legisladores.partidoId, partidoId))

    if (statsRes.length > 0) {
      estadisticasVoto = statsRes[0]
    }

    leyesDivididas = await db
      .select({
        proyectoId: proyectosLey.id,
        nombre: proyectosLey.nombre,
        fecha: sesiones.fecha,
        afirmativos: sql<number>`SUM(CASE WHEN ${votos.voto} = 'afirmativo' THEN 1 ELSE 0 END)`,
        negativos: sql<number>`SUM(CASE WHEN ${votos.voto} = 'negativo' THEN 1 ELSE 0 END)`,
      })
      .from(votos)
      .innerJoin(legisladores, eq(votos.legisladorId, legisladores.id))
      .innerJoin(proyectosLey, eq(votos.proyectoLeyId, proyectosLey.id))
      .innerJoin(sesiones, eq(proyectosLey.sesionId, sesiones.id))
      .where(
        and(
          eq(legisladores.partidoId, partidoId),
          sql`${votos.voto} != 'ausente'`
        )
      )
      .groupBy(proyectosLey.id)
      .having(sql`SUM(CASE WHEN ${votos.voto} = 'negativo' THEN 1 ELSE 0 END) > 0`)
      .orderBy(
        sql`ABS(SUM(CASE WHEN ${votos.voto} = 'afirmativo' THEN 1 ELSE 0 END) - SUM(CASE WHEN ${votos.voto} = 'negativo' THEN 1 ELSE 0 END))`
      )
      .limit(10)
  } catch {
    // DB not available
  }

  if (!partido) notFound()

  const senadores = miembros.filter((m) => m.camara === 'senado')
  const representantes = miembros.filter((m) => m.camara === 'representantes')

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <span
            className="rounded-full px-4 py-1.5 text-sm font-semibold text-white"
            style={{ backgroundColor: partido.color || '#6b7280' }}
          >
            {partido.sigla}
          </span>
          <h1 className="text-3xl font-bold text-gray-900">{partido.nombre}</h1>
        </div>
      </div>

      {/* Estadísticas de votación */}
      {estadisticasVoto.total > 0 && (
        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-gray-900">
              {estadisticasVoto.total}
            </div>
            <div className="text-xs text-gray-500">Votos totales</div>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {Math.round((estadisticasVoto.afirmativos / estadisticasVoto.total) * 100)}%
            </div>
            <div className="text-xs text-gray-500">Afirmativo</div>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-red-600">
              {Math.round((estadisticasVoto.negativos / estadisticasVoto.total) * 100)}%
            </div>
            <div className="text-xs text-gray-500">Negativo</div>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-gray-600">
              {Math.round((estadisticasVoto.ausentes / estadisticasVoto.total) * 100)}%
            </div>
            <div className="text-xs text-gray-500">Ausente</div>
          </div>
        </div>
      )}

      {/* Legisladores */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {senadores.length > 0 && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              Senadores ({senadores.length})
            </h2>
            <ul className="space-y-2">
              {senadores.map((leg) => (
                <li key={leg.id}>
                  <Link
                    href={`/legislador/${leg.id}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
                  >
                    <span className="font-medium text-[#002868]">{leg.nombre}</span>
                    {leg.departamento && (
                      <span className="text-xs text-gray-400">{leg.departamento}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {representantes.length > 0 && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              Representantes ({representantes.length})
            </h2>
            <ul className="space-y-2">
              {representantes.map((leg) => (
                <li key={leg.id}>
                  <Link
                    href={`/legislador/${leg.id}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
                  >
                    <span className="font-medium text-[#002868]">{leg.nombre}</span>
                    {leg.departamento && (
                      <span className="text-xs text-gray-400">{leg.departamento}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Leyes más divididas dentro del partido */}
      {leyesDivididas.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Leyes con mayor division interna
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="pb-2 pr-4">Proyecto</th>
                  <th className="pb-2 pr-4">Fecha</th>
                  <th className="pb-2 pr-4 text-right">Afirmativos</th>
                  <th className="pb-2 text-right">Negativos</th>
                </tr>
              </thead>
              <tbody>
                {leyesDivididas.map((ley) => (
                  <tr key={ley.proyectoId} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/ley/${ley.proyectoId}`}
                        className="font-medium text-[#002868] hover:underline"
                      >
                        {ley.nombre}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{ley.fecha}</td>
                    <td className="py-3 pr-4 text-right font-medium text-green-600">
                      {ley.afirmativos}
                    </td>
                    <td className="py-3 text-right font-medium text-red-600">
                      {ley.negativos}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
